import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLASSIFIER_PATH = path.resolve(__dirname, '../../classifier/classify.py');

/**
 * Classify an array of jobs using the Python classifier.
 * Each job should have { title, description, location }.
 * Returns array of { label, confidence, reasons }.
 */
export async function classifyJobs(jobs) {
  const input = JSON.stringify(
    jobs.map(j => ({
      title: j.title || '',
      description: j.description_text || '',
      location: j.location_text || '',
    }))
  );

  return new Promise((resolve, reject) => {
    const proc = spawn('python3', [CLASSIFIER_PATH], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', chunk => { stdout += chunk; });
    proc.stderr.on('data', chunk => { stderr += chunk; });

    proc.on('close', code => {
      if (code !== 0) {
        reject(new Error(`Classifier exited with code ${code}: ${stderr}`));
        return;
      }
      try {
        const results = JSON.parse(stdout);
        resolve(results);
      } catch (err) {
        reject(new Error(`Classifier JSON parse error: ${err.message}\nOutput: ${stdout}`));
      }
    });

    proc.on('error', reject);
    proc.stdin.write(input);
    proc.stdin.end();
  });
}
