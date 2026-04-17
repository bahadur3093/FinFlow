import { execFile } from 'child_process';
import { writeFile, readFile, unlink, access } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const PASSWORD_STDERR_PATTERNS = ['invalid password', 'password', 'decrypt', 'authentication'];

export async function unlockPdf(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: 'No PDF file uploaded' });
  }

  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ error: 'Password is required' });
  }

  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const inputPath = join(tmpdir(), `input-${id}.pdf`);
  const outputPath = join(tmpdir(), `output-${id}.pdf`);

  try {
    await writeFile(inputPath, req.file.buffer);

    try {
      // --warning-exit-0 makes qpdf exit 0 for warnings (instead of 2),
      // so only real errors (exit 3) throw here.
      await execFileAsync('qpdf', [
        '--warning-exit-0',
        `--password=${password}`,
        '--decrypt',
        inputPath,
        outputPath,
      ]);
    } catch (qpdfErr) {
      const stderr = (qpdfErr.stderr || qpdfErr.message || '').toLowerCase();
      const isWrongPassword = PASSWORD_STDERR_PATTERNS.some((p) => stderr.includes(p));
      return res.status(400).json({
        error: isWrongPassword
          ? 'Incorrect password. Please try again.'
          : `Failed to unlock PDF. ${qpdfErr.stderr?.trim() || 'The file may be corrupted or use unsupported encryption.'}`,
      });
    }

    // qpdf exits 0 even for unencrypted files — still serve the result
    const outputExists = await access(outputPath).then(() => true).catch(() => false);
    if (!outputExists) {
      return res.status(500).json({ error: 'Decryption produced no output. Please try again.' });
    }

    const unlockedBuffer = await readFile(outputPath);
    const originalName = req.file.originalname.replace(/\.pdf$/i, '');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${originalName}-unlocked.pdf"`);
    res.setHeader('Content-Length', unlockedBuffer.length);
    res.send(unlockedBuffer);
  } finally {
    unlink(inputPath).catch(() => {});
    unlink(outputPath).catch(() => {});
  }
}
