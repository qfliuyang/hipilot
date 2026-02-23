import ora from 'ora';

const spinners = {
  dots: 'dots',
  line: 'line',
  pipe: 'pipe',
  dots2: 'dots2',
  circle: 'circle',
  squish: 'squish',
  triangle: 'triangle',
  arrow: 'arrow',
  bounce: 'bounce',
  boxing: 'boxing',
};

const activeSpinners = new Map();

function start(message, type = 'dots') {
  const spinner = ora({
    text: message,
    spinner: spinners[type] || spinners.dots,
    color: 'cyan',
  }).start();
  
  const id = Date.now().toString();
  activeSpinners.set(id, spinner);
  return id;
}

function update(id, message) {
  const spinner = activeSpinners.get(id);
  if (spinner) {
    spinner.text = message;
  }
}

function succeed(id, message) {
  const spinner = activeSpinners.get(id);
  if (spinner) {
    spinner.succeed(message);
    activeSpinners.delete(id);
  }
}

function fail(id, message) {
  const spinner = activeSpinners.get(id);
  if (spinner) {
    spinner.fail(message);
    activeSpinners.delete(id);
  }
}

function warn(id, message) {
  const spinner = activeSpinners.get(id);
  if (spinner) {
    spinner.warn(message);
    activeSpinners.delete(id);
  }
}

function info(id, message) {
  const spinner = activeSpinners.get(id);
  if (spinner) {
    spinner.info(message);
    activeSpinners.delete(id);
  }
}

function stop(id) {
  const spinner = activeSpinners.get(id);
  if (spinner) {
    spinner.stop();
    activeSpinners.delete(id);
  }
}

function stopAll() {
  for (const [id, spinner] of activeSpinners) {
    spinner.stop();
  }
  activeSpinners.clear();
}

async function withSpinner(message, fn, type = 'dots') {
  const id = start(message, type);
  try {
    const result = await fn();
    succeed(id);
    return result;
  } catch (error) {
    fail(id, error.message);
    throw error;
  }
}

const EDA_MESSAGES = {
  timing: 'Analyzing timing paths...',
  drc: 'Checking design rules...',
  power: 'Calculating power consumption...',
  area: 'Measuring area utilization...',
  generate: 'Generating Tcl script...',
  send: 'Sending to EDA tool...',
  fix: 'Fixing timing violations...',
  route: 'Running routing...',
  cts: 'Building clock tree...',
};

function edaSpinner(operation) {
  return start(EDA_MESSAGES[operation] || `Running ${operation}...`);
}

export {
  start,
  update,
  succeed,
  fail,
  warn,
  info,
  stop,
  stopAll,
  withSpinner,
  edaSpinner,
  EDA_MESSAGES
};
