import * as os from 'os';
import * as path from 'path';
// The same disposable database as the integration tests: postgres-test.
import './setup-integration';

/** The e2e tests cover HTTP: no Redis, no jobs. */
process.env.JOBS_ENABLED = 'false';
// Small, so the size limit is cheap to cross.
process.env.PROOF_MAX_FILE_BYTES = '4096';
process.env.PROOF_STORAGE_DIR = path.join(os.tmpdir(), `rifas-e2e-proofs-${process.pid}`);
process.env.MAGIC_LINK_BASE_URL = 'https://rifas.test/acceso';
// No email service: the tests read the access links from a recording mailer.
process.env.NOTIFICATIONS_URL = '';
process.env.NOTIFICATIONS_SERVICE_TOKEN = '';
