export function makeLogger() {
  const logger = {
    stdout: '',
    log: text => {
      logger.stdout += text;
    },
  };
  return logger;
}

export function getInput() {
  return new Promise(resolve => resolve(''));
}

