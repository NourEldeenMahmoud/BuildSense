import { Command } from 'commander';
import { compatibilityExtractCommand } from './compatibility-extract-command.js';

// ---------------------------------------------------------------------------
// Compatibility command group — registers subcommands
// ---------------------------------------------------------------------------

export const compatibilityCommand = new Command('compatibility')
  .description('Compatibility facts and quality reporting commands')
  .addCommand(compatibilityExtractCommand);
