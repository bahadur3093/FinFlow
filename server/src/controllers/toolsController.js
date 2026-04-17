import { execFile } from 'child_process';
import { writeFile, readFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

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

    await execFileAsync('qpdf', ['--password=' + password, '--decrypt', inputPath, outputPath]);

    const unlockedBuffer = await readFile(outputPath);

    const originalName = req.file.originalname.replace(/\.pdf$/i, '');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${originalName}-unlocked.pdf"`);
    res.setHeader('Content-Length', unlockedBuffer.length);
    res.send(unlockedBuffer);
  } catch (err) {
    const isWrongPassword =
      err.stderr?.includes('invalid password') ||
      err.message?.includes('invalid password') ||
      err.code === 2;

    res.status(400).json({
      error: isWrongPassword
        ? 'Incorrect password. Please try again.'
        : 'Failed to unlock PDF. The file may be corrupted or use unsupported encryption.',
    });
  } finally {
    unlink(inputPath).catch(() => {});
    unlink(outputPath).catch(() => {});
  }
}
