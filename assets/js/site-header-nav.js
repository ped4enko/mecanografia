/**
 * Progressive header nav: as the viewport shrinks, move links into a burger
 * menu starting from the rightmost item, until only brand + burger remain.
 */
(function () {
  'use strict';

  var HIDE_RE = /\bhidden\b|\b(?:sm|md|lg|xl|2xl):(?:inline|block|flex|inline-flex|inline-block)\b/g;

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  function cleanLinkClasses(el) {
    if (!el.className) return;
    el.className = el.className
      .replace(HIDE_RE, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function findSiteHeaders() {
    return Array.prototype.slice.call(document.querySelectorAll('header')).filter(function (header) {
      return /sticky/.test(header.className) && header.querySelector('nav');
    });
  }

  function enhanceHeader(header) {
    var nav = header.querySelector('nav[aria-label], nav');
    if (!nav || nav.getAttribute('data-progressive-nav') === 'ready') return;

    var inner = nav.parentElement;
    if (inner) {
      inner.classList.add('site-header-inner');
      var brand = inner.firstElementChild;
      if (brand) brand.classList.add('site-brand');
    }

    var children = Array.prototype.slice.call(nav.children);
    var links = [];
    var tools = [];
    children.forEach(function (child) {
      if (child.tagName === 'A') {
        cleanLinkClasses(child);
        child.setAttribute('data-nav-index', String(links.length));
        child.classList.add('site-nav-link');
        links.push(child);
      } else {
        tools.push(child);
      }
    });

    if (!links.length) return;

    nav.classList.add('site-nav');
    nav.setAttribute('data-progressive-nav', 'ready');
    // Drop Tailwind gap utilities that fight the measured layout; CSS owns spacing.
    nav.style.gap = '0.65rem';

    var linksWrap = document.createElement('div');
    linksWrap.className = 'site-nav-links';
    linksWrap.style.gap = '0.65rem';

    var toolsWrap = document.createElement('div');
    toolsWrap.className = 'site-nav-tools';

    var panel = document.createElement('div');
    panel.className = 'site-nav-panel';
    panel.id = 'site-nav-panel-' + Math.random().toString(36).slice(2, 8);
    panel.hidden = true;
    panel.setAttribute('role', 'menu');

    var burger = document.createElement('button');
    burger.type = 'button';
    burger.className = 'site-nav-burger';
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-controls', panel.id);
    burger.setAttribute('aria-label', 'Abrir menú');
    burger.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">menu</span>';

    links.forEach(function (link) {
      linksWrap.appendChild(link);
    });
    toolsWrap.appendChild(burger);
    tools.forEach(function (tool) {
      toolsWrap.appendChild(tool);
    });

    nav.textContent = '';
    nav.appendChild(linksWrap);
    nav.appendChild(toolsWrap);
    nav.appendChild(panel);

    var open = false;

    function setOpen(next) {
      open = !!next;
      nav.classList.toggle('is-open', open);
      panel.hidden = !open;
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      burger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
      var icon = burger.querySelector('.material-symbols-outlined');
      if (icon) icon.textContent = open ? 'close' : 'menu';
    }

    function restoreLinks() {
      var all = Array.prototype.slice.call(panel.querySelectorAll('a[data-nav-index]'))
        .concat(Array.prototype.slice.call(linksWrap.querySelectorAll('a[data-nav-index]')));
      all.sort(function (a, b) {
        return Number(a.getAttribute('data-nav-index')) - Number(b.getAttribute('data-nav-index'));
      });
      all.forEach(function (link) {
        link.removeAttribute('role');
        linksWrap.appendChild(link);
      });
    }

    function overflows() {
      if (linksWrap.scrollWidth > linksWrap.clientWidth + 1) return true;
      if (inner && inner.scrollWidth > inner.clientWidth + 1) return true;
      return false;
    }

    function layout() {
      var wasOpen = open;
      setOpen(false);
      restoreLinks();
      nav.classList.remove('is-overflowing');

      var forceAll = (inner ? inner.clientWidth : window.innerWidth) <= 520;

      // If anything overflows (or mobile force), show the burger then keep
      // moving rightmost links into the panel until brand + tools fit.
      if (forceAll || overflows()) {
        nav.classList.add('is-overflowing');
        var guard = 0;
        while ((forceAll ? linksWrap.children.length > 0 : overflows()) && linksWrap.children.length && guard < 40) {
          var rightmost = linksWrap.lastElementChild;
          if (!rightmost) break;
          rightmost.setAttribute('role', 'menuitem');
          panel.insertBefore(rightmost, panel.firstChild);
          guard++;
        }
        // After revealing the burger, continue collapsing if it caused overflow.
        while (!forceAll && overflows() && linksWrap.children.length && guard < 40) {
          rightmost = linksWrap.lastElementChild;
          if (!rightmost) break;
          rightmost.setAttribute('role', 'menuitem');
          panel.insertBefore(rightmost, panel.firstChild);
          guard++;
        }
      }

      var hasOverflow = panel.children.length > 0;
      nav.classList.toggle('is-overflowing', hasOverflow);
      if (!hasOverflow) setOpen(false);
      else if (wasOpen) setOpen(true);
    }

    burger.addEventListener('click', function (e) {
      e.stopPropagation();
      setOpen(!open);
    });

    panel.addEventListener('click', function (e) {
      if (e.target && e.target.closest('a')) setOpen(false);
    });

    document.addEventListener('click', function (e) {
      if (!open) return;
      if (!nav.contains(e.target)) setOpen(false);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && open) setOpen(false);
    });

    var resizeTimer = null;
    window.addEventListener('resize', function () {
      if (resizeTimer) window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(layout, 50);
    });

    if (window.ResizeObserver && inner) {
      var ro = new ResizeObserver(function () { layout(); });
      ro.observe(inner);
    }

    // Fonts / icons can change metrics after first paint.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(layout).catch(function () {});
    }

    layout();
    window.setTimeout(layout, 100);
    window.setTimeout(layout, 400);
  }

  ready(function () {
    findSiteHeaders().forEach(enhanceHeader);
    initInPageAnchors();
  });

  function stickyHeaderOffset() {
    var header = document.querySelector('header.sticky, header[class*="sticky"]');
    return (header ? header.getBoundingClientRect().height : 64) + 10;
  }

  function scrollToAnchorId(id, smooth) {
    if (!id) return false;
    var el = document.getElementById(id);
    if (!el) return false;
    var top = el.getBoundingClientRect().top + window.pageYOffset - stickyHeaderOffset();
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({
      top: Math.max(0, top),
      behavior: smooth && !reduce ? 'smooth' : 'auto'
    });
    return true;
  }

  function initInPageAnchors() {
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href]');
      if (!a) return;
      var href = a.getAttribute('href');
      if (!href || href.charAt(0) === '?' || href.indexOf('mailto:') === 0) return;

      var url;
      try {
        url = new URL(a.href, window.location.href);
      } catch (err) {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (!url.hash || url.hash === '#') return;

      var samePath = url.pathname === window.location.pathname
        || (url.pathname.replace(/\/$/, '') === window.location.pathname.replace(/\/$/, ''));
      if (!samePath) return;

      var id = decodeURIComponent(url.hash.slice(1));
      if (!document.getElementById(id)) return;

      e.preventDefault();
      if (window.history && window.history.pushState) {
        window.history.pushState(null, '', url.pathname + url.search + url.hash);
      } else {
        window.location.hash = url.hash;
      }
      scrollToAnchorId(id, true);
    });

    function applyHash() {
      var hash = window.location.hash;
      if (!hash || hash === '#') return;
      scrollToAnchorId(decodeURIComponent(hash.slice(1)), false);
    }

    // Re-apply after layout / autofocus races on first paint.
    window.setTimeout(applyHash, 0);
    window.setTimeout(applyHash, 120);
    window.addEventListener('hashchange', function () {
      applyHash();
    });
    window.addEventListener('popstate', function () {
      applyHash();
    });
  }
})();
