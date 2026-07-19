import { describe, it, expect } from 'vitest';
import { elNourCommand, elNourTechAliasCommand } from './el-nour.js';

describe('el-nour commands', () => {
  it('el-nour parent command is registered', () => {
    expect(elNourCommand.name()).toBe('el-nour');
    expect(elNourCommand.description()).toContain('El Nour Tech store scraper commands');
  });

  it('el-nour full subcommand exists', () => {
    const fullCmd = elNourCommand.commands.find((cmd) => cmd.name() === 'full');
    expect(fullCmd).toBeDefined();
    expect(fullCmd!.description()).toContain('full discovery');
  });

  it('el-nour category subcommand exists', () => {
    const cmd = elNourCommand.commands.find((cmd) => cmd.name() === 'category');
    expect(cmd).toBeDefined();
    expect(cmd!.description()).toContain('specific category seed');
  });

  it('el-nour url subcommand exists', () => {
    const cmd = elNourCommand.commands.find((cmd) => cmd.name() === 'url');
    expect(cmd).toBeDefined();
    expect(cmd!.description()).toContain('single El Nour product URL');
  });

  it('el-nour live-sample subcommand exists', () => {
    const cmd = elNourCommand.commands.find((cmd) => cmd.name() === 'live-sample');
    expect(cmd).toBeDefined();
    expect(cmd!.description()).toContain('Fetch and parse');
  });

  it('el-nour import-captures subcommand exists', () => {
    const cmd = elNourCommand.commands.find((cmd) => cmd.name() === 'import-captures');
    expect(cmd).toBeDefined();
    expect(cmd!.description()).toContain('browser-captured');
  });

  it('el-nour has 5 subcommands', () => {
    expect(elNourCommand.commands).toHaveLength(5);
  });

  it('el-nour full accepts --run-id option', () => {
    const fullCmd = elNourCommand.commands.find((cmd) => cmd.name() === 'full');
    const opts = fullCmd!.options.map((o) => o.long);
    expect(opts).toContain('--run-id');
  });

  it('el-nour category accepts --run-id option', () => {
    const cmd = elNourCommand.commands.find((cmd) => cmd.name() === 'category');
    const opts = cmd!.options.map((o) => o.long);
    expect(opts).toContain('--run-id');
  });

  it('el-nour url accepts --dry-run option', () => {
    const cmd = elNourCommand.commands.find((cmd) => cmd.name() === 'url');
    const opts = cmd!.options.map((o) => o.long);
    expect(opts).toContain('--dry-run');
  });

  it('el-nour live-sample accepts --url option', () => {
    const cmd = elNourCommand.commands.find((cmd) => cmd.name() === 'live-sample');
    const opts = cmd!.options.map((o) => o.long);
    expect(opts).toContain('--url');
  });

  it('el-nour import-captures accepts --publish option', () => {
    const cmd = elNourCommand.commands.find((cmd) => cmd.name() === 'import-captures');
    const opts = cmd!.options.map((o) => o.long).filter(Boolean);
    expect(opts).toContain('--publish');
  });

  // -----------------------------------------------------------------------
  // el-nour-tech alias tests
  // -----------------------------------------------------------------------

  it('el-nour-tech alias parent command is registered', () => {
    expect(elNourTechAliasCommand.name()).toBe('el-nour-tech');
    expect(elNourTechAliasCommand.description()).toContain('Alias for el-nour');
  });

  it('el-nour-tech alias has same subcommands as el-nour', () => {
    const elNourNames = elNourCommand.commands.map((cmd) => cmd.name()).sort();
    const aliasNames = elNourTechAliasCommand.commands.map((cmd) => cmd.name()).sort();
    expect(aliasNames).toEqual(elNourNames);
  });

  it('el-nour-tech alias import-captures subcommand exists', () => {
    const cmd = elNourTechAliasCommand.commands.find((cmd) => cmd.name() === 'import-captures');
    expect(cmd).toBeDefined();
    expect(cmd!.description()).toContain('browser-captured');
  });

  it('el-nour-tech has 5 subcommands', () => {
    expect(elNourTechAliasCommand.commands).toHaveLength(5);
  });
});
