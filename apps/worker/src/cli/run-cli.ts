import { Command } from 'commander';
import { healthCommand } from '../commands/health.js';

const program = new Command();

program.name('buildsense-worker').description('BuildSense Worker CLI').version('0.0.0');
program.addCommand(healthCommand);
program.parse();
