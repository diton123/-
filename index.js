
const Module = require('module');

const originalLoad = Module._load;

const ROOT_UTIL_NAMES = new Set([
  'logger',
  'database',
  'relay',
  'spamGuard',
  'linkFilter',
  'wordFilter',
  'activityTracker',
  'permissions',
  'adminStore',
  'tickets'
]);

Module._load = function(request, parent, isMain) {
  const match = request.match(/(?:\.\.\/|\.\/)?utils\/([^/]+)$/);

  if (match && ROOT_UTIL_NAMES.has(match[1])) {
    return originalLoad.call(
      this,
      require('path').join(__dirname, match[1] + '.js'),
      parent,
      isMain
    );
  }

  if (
    request.startsWith('./') &&
    ROOT_UTIL_NAMES.has(request.slice(2))
  ) {
    return originalLoad.call(
      this,
      require('path').join(__dirname, request.slice(2) + '.js'),
      parent,
      isMain
    );
  }

  return originalLoad.call(this, request, parent, isMain);
};
