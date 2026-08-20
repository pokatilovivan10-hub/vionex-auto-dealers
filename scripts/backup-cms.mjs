import { config } from '../src/config.mjs';
import { openCmsDatabase } from '../src/cms/database.mjs';
const db = openCmsDatabase(config.dataDir, config.cms?.databasePath);
try {
  const file = db.backup('cli');
  console.log(file);
} finally {
  db.close();
}
