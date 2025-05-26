const fs = require('fs');
const path = require('path');

class ManifestPlugin {
  constructor(options) {
    this.browser = options.browser || 'chrome';
    this.manifestDir = options.manifestDir || './manifest';
  }

  apply(compiler) {
    const pluginName = 'ManifestPlugin';
    const { webpack } = compiler;

    compiler.hooks.thisCompilation.tap(pluginName, (compilation) => {
      compilation.hooks.processAssets.tap(
        {
          name: pluginName,
          stage: webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL
        },
        () => {
          try {
            // Load manifest parts
            const baseManifest = require(path.resolve(this.manifestDir, 'base.json'));
            const browserOverrides = require(path.resolve(this.manifestDir, `${this.browser}.json`));

            // Generate merged manifest
            const manifest = this.deepMerge(baseManifest, browserOverrides);
            const manifestContent = JSON.stringify(manifest, null, 2);

            // Add manifest to webpack output
            compilation.emitAsset(
              'manifest.json',
              new webpack.sources.RawSource(manifestContent)
            );

            console.log(`Generated ${this.browser} manifest directly in build output`);
          } catch (error) {
            compilation.errors.push(error);
          }
        }
      );
    });
  }

  deepMerge(target, source) {
    const output = {...target};
    
    if (this.isObject(target) && this.isObject(source)) {
      Object.keys(source).forEach(key => {
        if (this.isObject(source[key])) {
          if (!(key in target)) {
            Object.assign(output, { [key]: source[key] });
          } else {
            output[key] = this.deepMerge(target[key], source[key]);
          }
        } else if (Array.isArray(source[key]) && Array.isArray(target[key])) {
          // Merge arrays - for permissions and similar fields
          output[key] = [...new Set([...target[key], ...source[key]])];
        } else {
          Object.assign(output, { [key]: source[key] });
        }
      });
    }
    
    return output;
  }

  isObject(item) {
    return (item && typeof item === 'object' && !Array.isArray(item));
  }
}

module.exports = ManifestPlugin;