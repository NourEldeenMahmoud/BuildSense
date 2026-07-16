import { Command } from 'commander';
import { healthCommand } from '../commands/health.js';
import { sigmaCommand, sigmaBootstrapImportAliasCommand } from '../commands/sigma.js';
import { compatibilityCommand } from '../commands/compatibility.js';

const program = new Command();

program.name('buildsense-worker').description('BuildSense Worker CLI').version('0.0.0');
program.addCommand(healthCommand);
program.addCommand(sigmaCommand);
program.addCommand(sigmaBootstrapImportAliasCommand);
program.addCommand(compatibilityCommand);
program.parse();
