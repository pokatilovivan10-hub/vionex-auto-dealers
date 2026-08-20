import process from 'node:process';
import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { config } from '../src/config.mjs';
import { openCmsDatabase } from '../src/cms/database.mjs';
import { hashPassword } from '../src/cms/auth.mjs';

function argument(name) {
  const prefix = `--${name}=`;
  const exact = process.argv.indexOf(`--${name}`);
  const inline = process.argv.find((value) => value.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  if (exact >= 0) return process.argv[exact + 1] || '';
  return '';
}

async function hiddenPrompt(question) {
  if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') {
    const rl = readline.createInterface({ input: stdin, output: stdout });
    const value = await rl.question(question);
    rl.close();
    return value;
  }
  return await new Promise((resolve, reject) => {
    let value = '';
    stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    const onData = (char) => {
      if (char === '\u0003') {
        cleanup();
        reject(new Error('Отменено пользователем.'));
        return;
      }
      if (char === '\r' || char === '\n') {
        stdout.write('\n');
        cleanup();
        resolve(value);
        return;
      }
      if (char === '\u007f' || char === '\b') {
        if (value.length) {
          value = value.slice(0, -1);
          stdout.write('\b \b');
        }
        return;
      }
      if (char >= ' ') {
        value += char;
        stdout.write('•');
      }
    };
    const cleanup = () => {
      stdin.off('data', onData);
      stdin.setRawMode(false);
      stdin.pause();
    };
    stdin.on('data', onData);
  });
}

async function main() {
  const db = openCmsDatabase(config.dataDir, config.cms?.databasePath);
  const rl = readline.createInterface({ input: stdin, output: stdout });
  try {
    const username = (argument('username') || process.env.ADMIN_USERNAME || await rl.question('Логин администратора [admin]: ')).trim() || 'admin';
    const existing = db.getUserByUsername(username);
    if (existing && !process.argv.includes('--reset')) {
      throw new Error(`Пользователь ${username} уже существует. Для смены пароля выполните npm run admin:password.`);
    }
    rl.pause();
    const password = argument('password') || process.env.ADMIN_PASSWORD || await hiddenPrompt('Пароль (минимум 12 символов): ');
    const confirmation = argument('password') || process.env.ADMIN_PASSWORD || await hiddenPrompt('Повторите пароль: ');
    if (password !== confirmation) throw new Error('Пароли не совпадают.');
    const passwordHash = await hashPassword(password);
    if (existing) {
      db.updateUserPassword(existing.id, passwordHash);
      console.log(`Пароль пользователя ${username} обновлён. Все старые сессии завершены.`);
    } else {
      db.createUser({ username, passwordHash, role: 'owner' });
      console.log(`Администратор ${username} создан.`);
    }
    console.log('Админка: /admin');
  } finally {
    rl.close();
    db.close();
  }
}

main().catch((error) => {
  console.error(`Ошибка: ${error.message}`);
  process.exit(1);
});
