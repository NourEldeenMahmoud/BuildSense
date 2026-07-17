import { Command } from 'commander';
import { healthCommand } from '../commands/health.js';
import { sigmaCommand, sigmaBootstrapImportAliasCommand } from '../commands/sigma.js';
import { compatibilityCommand } from '../commands/compatibility.js';
import { adminCommand } from '../commands/admin.js';
import { adminJobsCommand } from '../commands/admin-jobs.js';

const program = new Command();

program.name('buildsense-worker').description('BuildSense Worker CLI').version('0.0.0');
program.addCommand(healthCommand);
program.addCommand(sigmaCommand);
program.addCommand(sigmaBootstrapImportAliasCommand);
program.addCommand(compatibilityCommand);
program.addCommand(adminCommand);
program.addCommand(adminJobsCommand);
program.parse();
