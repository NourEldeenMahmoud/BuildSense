import { describe, it, expect } from 'vitest';
import { Option } from 'commander';
import { sigmaCommand, sigmaBootstrapImportAliasCommand } from './sigma.js';

describe('sigma commands', () => {
  it('sigma:bootstrap-import alias command is registered', () => {
    expect(sigmaBootstrapImportAliasCommand.name()).toBe('sigma:bootstrap-import');
  });
  it('sigma parent command is registered', () => {
    expect(sigmaCommand.name()).toBe('sigma');
    expect(sigmaCommand.description()).toContain('Sigma store scraper commands');
  });

  it('sigma full subcommand exists', () => {
    const fullCmd = sigmaCommand.commands.find((cmd) => cmd.name() === 'full');
    expect(fullCmd).toBeDefined();
    expect(fullCmd!.description()).toContain('full discovery');
  });

  it('sigma category subcommand exists', () => {
    const cmd = sigmaCommand.commands.find((cmd) => cmd.name() === 'category');
    expect(cmd).toBeDefined();
    expect(cmd!.description()).toContain('specific category');
  });

  it('sigma url subcommand exists', () => {
    const cmd = sigmaCommand.commands.find((cmd) => cmd.name() === 'url');
    expect(cmd).toBeDefined();
    expect(cmd!.description()).toContain('single Sigma product URL');
  });

  it('sigma bootstrap-import subcommand exists', () => {
    const cmd = sigmaCommand.commands.find((cmd) => cmd.name() === 'bootstrap-import');
    expect(cmd).toBeDefined();
    expect(cmd!.description()).toContain('bootstrap import');
  });

  it('sigma live-sample subcommand exists', () => {
    const cmd = sigmaCommand.commands.find((cmd) => cmd.name() === 'live-sample');
    expect(cmd).toBeDefined();
    expect(cmd!.description()).toContain('live Sigma product');
  });

  function hasOption(cmd: import('commander').Command, longName: string): boolean {
    return cmd.options.some((opt: Option) => opt.long === longName);
  }

  it('sigma full accepts --run-id option', () => {
    const fullCmd = sigmaCommand.commands.find((cmd) => cmd.name() === 'full');
    expect(fullCmd).toBeDefined();
    expect(hasOption(fullCmd!, '--run-id')).toBe(true);
  });

  it('sigma category accepts --run-id option', () => {
    const cmd = sigmaCommand.commands.find((cmd) => cmd.name() === 'category');
    expect(cmd).toBeDefined();
    expect(hasOption(cmd!, '--run-id')).toBe(true);
  });

  it('sigma url accepts --dry-run option', () => {
    const cmd = sigmaCommand.commands.find((cmd) => cmd.name() === 'url');
    expect(cmd).toBeDefined();
    expect(hasOption(cmd!, '--dry-run')).toBe(true);
  });

  it('sigma bootstrap-import accepts --run-id and --seed-id options', () => {
    const cmd = sigmaCommand.commands.find((command) => command.name() === 'bootstrap-import');
    expect(cmd).toBeDefined();
    expect(hasOption(cmd!, '--run-id')).toBe(true);
    expect(hasOption(cmd!, '--seed-id')).toBe(true);
  });

  it('sigma live-sample accepts --url option', () => {
    const cmd = sigmaCommand.commands.find((cmd) => cmd.name() === 'live-sample');
    expect(cmd).toBeDefined();
    expect(hasOption(cmd!, '--url')).toBe(true);
  });

  it('has exactly 5 subcommands', () => {
    expect(sigmaCommand.commands).toHaveLength(5);
  });
});
