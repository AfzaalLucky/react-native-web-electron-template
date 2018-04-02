const gulp        = require('gulp');
const runSeq      = require('run-sequence');
const del         = require('del');
const plumber     = require('gulp-plumber');
const cache       = require('gulp-cached');
const webpack     = require('webpack');
const gulpWebpack = require('webpack-stream');
const path        = require('path');
const nodemon     = require('gulp-nodemon');
const exec        = require('child_process').exec;
const spawn       = require('child_process').spawn;
const os          = require('os');
const fs          = require('fs');
const configure   = require('./configure.js');
const buildConfig = JSON.parse(fs.readFileSync('../build.json', 'utf8'));


configure('dev');

const PATHS = {
    srcWebBuild: './src/web/index.js',
    outWebBuild: './build-web',
    srcDesktopBuild: './src/desktop/index.js',
    outDesktopBuild: './build-desktop',
    srcDesktopMainBuild: './src/desktop/electron-entry.js',
    outDesktopMainBuild: './build-desktop',
    srcWatch: [
        '../src',
        '../src/*',
        '../src/**/*'
    ]
};


function runCommand(command, callback, resetCursorLive, noOutput, filterFn) {
    
    console.log("[Command] Execute "+command);
    
    var command = spawn(command, {
      shell: true
    });

    command.stdout.on('data', function (data) {
      if(!noOutput) {
        if(resetCursorLive) {
          process.stdout.write('\x1B[2J\x1B[0f');
        }
        if(filterFn) {
          data = filterFn(data);
        }
        process.stdout.write(data);
      }
    });

    command.stderr.on('data', function (data) {
      if(!noOutput) {
        if(resetCursorLive) {
          process.stdout.write('\x1B[2J\x1B[0f');
        }
        if(filterFn) {
          data = filterFn(data);
        }
        process.stdout.write(data);
      }
    });
    
    command.on('error', (err) => {
      if(!noOutput) {
        console.log('Error during execution of command!');
        console.log(err);
      }
    });

    command.on('exit', function (code) {
      if(!noOutput) {
        console.log('child process exited with code ' + code.toString());
        console.log("[Command] Command execution finished.");
        if(code != 0) {
          throw "Command returned a non-zero exit code! (could not execute the command)";
        }
      }
      callback(null);
    });
    
};

function runExpoCommandWithLogin(expoCommand, callback) {
    
  let expo_user = "root";
  let expo_passwd = "root";
  
  let expo_user_env = "EXPO_USER_LOGIN";
  let expo_passwd_env = "EXPO_USER_PASSWD";
  
  if(buildConfig['release']) {
    if(buildConfig['release']['expo-user-env']) {
      expo_user_env = buildConfig['release']['expo-user-env'];
    }
    
    if(buildConfig['release']['expo-passwd-env']) {
      expo_passwd_env = buildConfig['release']['expo-passwd-env'];
    }
  }
  
  if(!process.env[expo_user_env]) {
    throw "No "+expo_user_env+" environment variable was defined! Please define it.";
  } else {
    expo_user = process.env[expo_user_env];
  }
  
  if(!process.env[expo_passwd_env]) {
    throw "No "+expo_passwd_env+" environment variable was defined! Please define it.";
  } else {
    expo_passwd = process.env[expo_passwd_env];
  }
    
  const loginCommand = "cd .. && node node_modules/exp/bin/exp.js login --non-interactive -u \""+expo_user+"\" -p \""+expo_passwd+"\"";
  const logoutCommand = "cd .. && node node_modules/exp/bin/exp.js logout --non-interactive";
  
  console.log("[Expo command] Force try to logout (may-fail mode)...");
  exec(logoutCommand, function (err, stdout, stderr) {
      console.log(stdout);
      console.log(stderr);
      console.log("[Expo command] Try to login with given passwd and username...");
      
      let afterLoginExecuted = false;
      let timeoutKilled = false;
      
      const afterLogin = function() {
        if(afterLoginExecuted) return;
        afterLoginExecuted = true;
        console.log("[Expo command] Try to execute Expo command...");
        
        var command = spawn(expoCommand, {
          shell: true
        });

        command.stdout.on('data', function (data) {
          process.stdout.write(data);
        });

        command.stderr.on('data', function (data) {
          process.stdout.write(data);
        });
        
        command.on('error', (err) => {
          console.log('Error during execution of Expo command!');
          console.log(err);
        });

        command.on('exit', function (code) {
          console.log('child process exited with code ' + code.toString());
          console.log("[Expo command] Command execution attempt was performed.");
          if(code != 0) {
            throw "Expo command returned a non-zero exit code! (could not execute the Expo command)";
          }
          callback(err);
        });
        
      };
      
      const loginProcess = exec(loginCommand, function (err, stdout, stderr) {
        if(!timeoutKilled) {
          console.log("[Expo command] Login attempt performed.");
          console.log(stdout);
          console.log(stderr);
          if(err) {
            throw "Expo login returned an error (could not login)!";
          }
          afterLogin();
        }
      });
      
      setTimeout(function(){
          console.log("[Expo command] Killing login command - timeout (skip to executing commands)");
          timeoutKilled = true;
          loginProcess.kill();
          afterLogin();
      }, 5000);
  
  });
};

gulp.task('android-release', function(callback) {
  configure('release');
  runExpoCommandWithLogin("cd .. && node node_modules/exp/bin/exp.js build:android --non-interactive", callback);
});

gulp.task('ios-release', function(callback) {
  configure('release');
  runExpoCommandWithLogin("cd .. && node node_modules/exp/bin/exp.js build:ios --non-interactive", callback);
});

gulp.task('expo-start', function(callback) {
  runCommand("cd .. && react-native-scripts start --no-interactive", callback);
});

gulp.task('expo-start-android', function(callback) {
  runCommand("cd .. && react-native-scripts android --no-interactive", callback);
});

gulp.task('expo-start-ios', function(callback) {
  runCommand("cd .. && react-native-scripts ios --no-interactive", callback);
});

gulp.task('run-jest-tests', function(callback) {
  runCommand("cd .. && node node_modules/jest/bin/jest.js --verbose --colors --forceExit", callback);
});

gulp.task('run-flow-tests', function(callback) {
  const filterFn = function(input) {
    
    if (!String.prototype.padStart) {
      String.prototype.padStart = function padStart(targetLength,padString) {
        targetLength = targetLength>>0; //truncate if number or convert non-number to 0;
        padString = String((typeof padString !== 'undefined' ? padString : ' '));
        if (this.length > targetLength) {
          return String(this);
        } else {
          targetLength = targetLength-this.length;
          if (targetLength > padString.length) {
            padString += padString.repeat(targetLength/padString.length); //append to original to ensure we are longer than needed
          }
          return padString.slice(0,targetLength) + String(this);
        }
      };
    }
    
    if(input.toString().indexOf('Server is initializing') != -1) {
        
      let parsedFilesPart = input.toString().split('parsed files')[1];
      if(parsedFilesPart) {
        parsedFilesPart = parsedFilesPart.split(')')[0];
      }
        
      if(parsedFilesPart) {
        return '\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\bLoading... Parsed '+parsedFilesPart.toString().padStart(10)+' files';
      } else {
        return '\b\b\b\b\b\b\b\b\b\bLoading...';
      }
    } else if(input.toString().indexOf('Server is starting up') != -1) {
      return input.toString() + '\n\n            ';
    }
    return input;
  };
  runCommand("cd .. && node node_modules/flow-bin/cli.js --color always", callback, false, false, filterFn);
});

gulp.task('web-build:release', function(callback){
  configure('release');
  return gulp.src(PATHS.srcWebBuild, {cwd: '..'})
    .pipe(cache('webpack', {optimizeMemory: true}))
    .pipe(plumber())
    .pipe(gulpWebpack( require('./web.prod.config.js') ))
    .pipe(gulp.dest(PATHS.outWebBuild, {cwd: '..'}));
});

gulp.task('web-build:dev', function(callback){
  return gulp.src(PATHS.srcWebBuild, {cwd: '..'})
    .pipe(cache('webpack', {optimizeMemory: true}))
    .pipe(plumber())
    .pipe(gulpWebpack( require('./web.dev.config.js') ))
    .pipe(gulp.dest(PATHS.outWebBuild, {cwd: '..'}));
});

gulp.task('desktop-build-renderer:dev', function(callback){
  return gulp.src(PATHS.srcDesktopBuild, {cwd: '..'})
    .pipe(cache('webpack', {optimizeMemory: true}))
    .pipe(plumber())
    .pipe(gulpWebpack( require('./desktop.dev.config.js') ))
    .pipe(gulp.dest(PATHS.outDesktopBuild, {cwd: '..'}));
});

gulp.task('desktop-build-main:dev', function(callback){
  return gulp.src(PATHS.srcDesktopMainBuild, {cwd: '..'})
    .pipe(cache('webpack', {optimizeMemory: true}))
    .pipe(plumber())
    .pipe(gulpWebpack( require('./desktop-main.dev.config.js') ))
    .pipe(gulp.dest(PATHS.outDesktopMainBuild, {cwd: '..'}));
});

gulp.task('desktop-build-renderer:release', function(callback){
  return gulp.src(PATHS.srcDesktopBuild, {cwd: '..'})
    .pipe(cache('webpack', {optimizeMemory: true}))
    .pipe(plumber())
    .pipe(gulpWebpack( require('./desktop.release.config.js') ))
    .pipe(gulp.dest(PATHS.outDesktopBuild, {cwd: '..'}));
});

gulp.task('desktop-build-main:release', function(callback){
  return gulp.src(PATHS.srcDesktopMainBuild, {cwd: '..'})
    .pipe(cache('webpack', {optimizeMemory: true}))
    .pipe(plumber())
    .pipe(gulpWebpack( require('./desktop-main.release.config.js') ))
    .pipe(gulp.dest(PATHS.outDesktopMainBuild, {cwd: '..'}));
});


gulp.task('desktop-package', function(callback) {
  runCommand("cd .. && node node_modules/electron-forge/dist/forge.js make", callback);
});

gulp.task('web-watch', function() {
  gulp.start('web-build:dev');
  gulp.watch(
    PATHS.srcWatch,
    {
      interval: 3007,
      dot: true
    }, [
    'web-build:dev'
  ]);
});

gulp.task('desktop-watch', function() {
  gulp.start('desktop-build-renderer:dev', 'desktop-build-main:dev');
  gulp.watch(
    PATHS.srcWatch,
    {
      interval: 3007,
      dot: true
    }, [
    'desktop-build-renderer:dev',
    'desktop-build-main:dev'
  ]);
});

gulp.task('web-server', function(){
  nodemon({
    'script': './run-server.js',
    ext: 'html'
  })
});

gulp.task('desktop-server', function(){
  nodemon({
    'script': './run-electron.js'
  })
});

gulp.task('clear-cache', function () {
  var tempDir = os.tmpdir();

  var cacheFiles = fs.readdirSync(tempDir).filter(function (fileName) {
    return fileName.indexOf('react-packager-cache') === 0;
  });

  cacheFiles.forEach(function (cacheFile) {
    var cacheFilePath = path.join(tempDir, cacheFile);
    fs.unlinkSync(cacheFilePath);
    console.log('Deleted cache: ', cacheFilePath);
  });

  if (!cacheFiles.length) {
    console.log('No cache files found!');
  }
});

gulp.task('web-dev', function(){
  gulp.start('web-server', 'web-watch');
});

gulp.task('desktop-dev', function(){
  gulp.start('desktop-watch', 'desktop-server');
});

gulp.task('desktop-release', function(){
  runSeq('desktop-build-renderer:dev', 'desktop-build-main:dev', 'desktop-package');
});

gulp.task('web-release', function(){
  configure('release');
  gulp.start('web-build:release');
});

gulp.task('mobile-dev', function(){
  gulp.start('expo-start');
});

gulp.task('android-dev', function(){
  gulp.start('expo-start-android');
});

gulp.task('ios-dev', function(){
  gulp.start('expo-start-ios');
});

gulp.task('test-jest', function(){
  gulp.start('run-jest-tests');
});

gulp.task('test-flow', function(){
  gulp.start('run-flow-tests');
});

gulp.task('test', function(){
  runSeq('test-flow', 'test-jest');
});
