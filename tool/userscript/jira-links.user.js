// ==UserScript==
// @name         Slack links
// @version      0.1
// @description  Replaces link text for Github PRs and JIRA tickets.
// @match        https://wgaming.slack.com/*
// @grant        GM_xmlhttpRequest
// @connect      jira.webedia.fr
// @connect      github.com
// ==/UserScript==

const parser = new DOMParser();
const alreadyReplacedClass = '__REPLACED__';
const pageNamesPromises = {};

const iconTemplate = (base64png) => `<img style="vertical-align: text-top;" src="data:image/png;base64,${base64png}"/>`;
const jiraIconHtml = iconTemplate(`
  iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABmJLR0QA/wD/AP+gvaeTAAAACXBI
  WXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH4gQaCjgfynw1ygAAATRJREFUOMuNk8FRw0AMRd9mKMBU
  QKgAZ7J3QgWEDsgle0xSAVCB4bgnQgVJB7iAncEdxB2QDsRFmxHGYawZj7TS15es1ToR4Zw4H77V
  nEiKbS/GEjgf1kAFbIENkAmugRWwBl4kxeecMzpTvJAUj5qYqxcau/qFFBFEBKbLWdZMl0X2289g
  yuxzIoLzYQwcgCOwlxQXzocCKLVOKym2zocKmANj4E5SrE8zcD4cNACw0JYrPW+ABvjU81FSvOzO
  4MPYFVBrUgPsgZ2Jv2XjwjhfgXttuwDegQeN7cwQW8X2XmOpbWZwo7o0hSaSYtNLcIbEykJS3FrH
  nz1Q9s2Q5P8WqdGbsHLTBxz17P8Y+AJuOyRr58NsSAdPqh9V701sNYRgbuy6M4/5EILCrq8+pLrz
  iyf5AXqfkHABePGAAAAAAElFTkSuQmCC
`);
const githubIconHtml = iconTemplate(`
  iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABmJLR0QA/wD/AP+gvaeTAAAACXBI
  WXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH4gQaCwgTHU4lJQAAAiBJREFUOMuNUzFrFEEU/ua93dwm
  3s7d7t4RA3aCYCFYnhqNWAYsbASLFLb5BzaWgp2iRVDBIoUpRGxsRRPFwkaw1iAKicnd7dyRnLnb
  nXkWuQ2roMmr3jy+73vfvJmn8FfU6/VLzHwDwBUlMgMAotQGgNfW2mfGmNUyXpVybkTRU/a8Bfwn
  bJ4vt9P0JgBbFuAkSdY8onM4QuTOfeh0OhcBWAaARhQte8zzWZ6vjrLsejdNN4j5BCm1LSIdAarb
  7fatUZbd9jzvlM88O1mpnBzs7b2A1ro13WzKdLMpcRwvjZtUAUyVmlYLt3EcLxV4rXWLJpgXD+5n
  7ZNxugNgUBLYASAA4JxbKYoTzIsE5lkAsM6NAHSOMIJ169xwf3I8Sxg/FZTa7PV664exjTHfoNRP
  AIDIDBXWANQA0BEcEETq41xIgO8AwErVkiS5ehg7iqJ5JtLY7/yDSKk1J4Ktdtu6PH8eheGFf5Hj
  MDzPRI+Ls4i8oSzPH46GGUTEmn6/39vdfUdEA611qwAGQXCZiLb9IHjPRMdLAg/IGPPJr/iPppvN
  ibrvz1Wr1YUwDD8qpbYKYKVS2dFaN/740iL30jT9fLALcRS9JaIz1rmzItI3xpgSPmwkySYTTY33
  4WU7Ta+hPPVums5BqRUm+uoxfwEwUxI4VpDzPL9TkAGAy7YGg8GrySDYg1IN3/eXh8PhLwCo1Wq+
  EjntgPudbvdumfMbJe7aBenMssIAAAAASUVORK5CYII=
`);

const crossOriginRequest = (url) =>
  new Promise((resolve, reject) => {
    GM_xmlhttpRequest({
      url,
      method: 'GET',
      onload: resolve,
      onerror: reject
    });
  });

const getPageName = async function(pageUrl, extractNameFromDocument) {
  if (!pageNamesPromises[pageUrl]) {
    pageNamesPromises[pageUrl] = crossOriginRequest(pageUrl).then((response) => {
      const doc = parser.parseFromString(response.responseText, 'text/html');
      return extractNameFromDocument(doc);
    });
  }

  return pageNamesPromises[pageUrl];
};

const nameExtractorCreatorByPattern = {
  '^https://jira.webedia.fr/browse/([^?]*)': (jiraId) => (doc) => {
    const titleElement = doc.querySelector('#summary-val');
    return titleElement ? `${jiraIconHtml} ${jiraId} ${titleElement.textContent}` : null;
  },
  '^https://github.com/.*?/(.*?)/pull/(\\d+)': (projectName, prId) => (doc) => {
    const titleElement = doc.querySelector('h1.gh-header-title span');
    return titleElement ? `${githubIconHtml} PR ${titleElement.textContent.trim()} (${projectName}#${prId})` : null;
  }
};

const replaceLinksText = function() {
  const links = document.querySelectorAll(`.c-message__body a:not(.${alreadyReplacedClass})`);
  links.forEach((link) => {
    const linkText = link.textContent.trim();
    Object.keys(nameExtractorCreatorByPattern).forEach((pattern) => {
      link.classList.add(alreadyReplacedClass);

      const matches = linkText.match(new RegExp(pattern));

      if (!matches) {
        return;
      }

      const capturedParams = matches.slice(1);
      getPageName(linkText, nameExtractorCreatorByPattern[pattern](...capturedParams)).then((pageName) => {
        if (pageName) {
          link.innerHTML = pageName;
        }
      });
    });
  });
};

var observer = new MutationObserver(replaceLinksText);
observer.observe(document.querySelector('.client_main_container'), { subtree: true, childList: true });
