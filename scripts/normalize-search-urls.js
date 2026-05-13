'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { text } = require('node:stream/consumers');

hexo.extend.filter.register('after_generate', async () => {
  const searchRoute = hexo.route.get('search.xml');

  if (searchRoute) {
    const xml = await text(searchRoute);
    const normalized = xml.replace(/<url>\/\/(?!\/)/g, '<url>/');

    if (normalized !== xml) {
      hexo.route.set('search.xml', normalized);
    }

    return;
  }

  const searchPath = path.join(hexo.public_dir, 'search.xml');
  try {
    const xml = await fs.readFile(searchPath, 'utf8');
    const normalized = xml.replace(/<url>\/\/(?!\/)/g, '<url>/');

    if (normalized !== xml) {
      await fs.writeFile(searchPath, normalized);
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
});
