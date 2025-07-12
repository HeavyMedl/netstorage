import micromatch from 'micromatch';
import { Command } from 'commander';
import {
  setLastCommandResult,
  handleCliError,
  getLogLevelOverride,
  loadClientConfig,
  printJson,
  findAll,
  type createLogger,
} from '@/index';

export function createFindCommand(
  logger: ReturnType<typeof createLogger>,
): Command {
  const command = new Command('find')
    .description(
      'Search recursively for entries under a given remote directory',
    )
    .argument('<remotePath>', 'Remote directory to search')
    .option(
      '-i, --ignore-case',
      'Enable case-insensitive matching (micromatch `nocase`)',
    )
    .option('-l, --log-level <level>', 'Override the log level')
    .option(
      '-m, --max-depth <number>',
      'Limit recursion depth (default: full depth)',
      parseInt,
    )
    .option(
      '-n, --name <pattern>',
      'Glob pattern to match entry names (micromatch-compatible)',
    )
    .option(
      '--match-base',
      'Match against the basename if the pattern does not contain a slash',
    )
    .option('--match-dot', 'Allow patterns to match dotfiles')
    .option('--meta', 'Include full metadata in results')
    .option('--no-braces', 'Disable brace expansion in glob patterns')
    .option('--no-extglob', 'Disable support for extended glob patterns')
    .option('-p, --pretty', 'Pretty-print the JSON output')
    .option('-q, --quiet', 'Suppress standard output')
    .option('-v, --verbose', 'Enable verbose logging')
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  $ netstorage find /assets --name "*.jpg"',
        '  $ netstorage find /assets --name ".*" --match-dot',
        '  $ netstorage find /assets --name "*.JPG" --ignore-case -m 2',
      ].join('\n'),
    )
    .action(
      async (
        path: string,
        {
          name,
          maxDepth,
          pretty,
          logLevel,
          verbose,
          quiet,
          matchDot,
          matchBase,
          extglob,
          braces,
          ignoreCase,
          meta,
        },
      ) => {
        try {
          const inferredPath = path ?? '/';
          const config = await loadClientConfig(
            getLogLevelOverride(logLevel, verbose),
          );
          const result = await findAll(config, {
            path: inferredPath,
            maxDepth: maxDepth,
            predicate: (entry) => {
              if (!name) return true;
              return micromatch.isMatch(entry.file.name, name, {
                dot: matchDot,
                nocase: ignoreCase,
                matchBase,
                noextglob: extglob === false,
                nobrace: braces === false,
              });
            },
          });
          const output = meta ? result : result.map((entry) => entry.path);
          if (!quiet) printJson(output, pretty);
          setLastCommandResult(output);
        } catch (error) {
          handleCliError(error, logger);
        }
      },
    );

  return command;
}
