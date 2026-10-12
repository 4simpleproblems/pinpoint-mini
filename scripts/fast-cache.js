/**
 * Fast cache synchronous loader for Pinpoint
 * Eliminates flash of unstyled / default "World History" text and banner
 * Synchronously applies cached class name, teacher, banner, and circle icon.
 */
(function() {
  var BANNER_COLOR_MAP = {
    "WorldHistory.jpg": { "dominant": "#e06050", "sidebarBg": "#f5ecea", "sidebarHover": "#f0d9d6", "circleBg": "#f0d5d1", "circleText": "#792115" },
    "english.jpg": { "dominant": "#507080", "sidebarBg": "#ecf1f3", "sidebarHover": "#dce5e9", "circleBg": "#d9e3e7", "circleText": "#1d5672" },
    "Math.jpg": { "dominant": "#e02060", "sidebarBg": "#f5eaee", "sidebarHover": "#f0d6df", "circleBg": "#f0d1db", "circleText": "#7e1135" },
    "Chemistry.jpg": { "dominant": "#804090", "sidebarBg": "#f3eaf5", "sidebarHover": "#e9d8ee", "circleBg": "#e7d5ec", "circleText": "#611d72" },
    "Geometry.jpg": { "dominant": "#406060", "sidebarBg": "#edf3f3", "sidebarHover": "#dde9e9", "circleBg": "#dae7e7", "circleText": "#1d7272" },
    "SocialStudies.jpg": { "dominant": "#ffa020", "sidebarBg": "#f5f0ea", "sidebarHover": "#f0e5d6", "circleBg": "#f0e2d1", "circleText": "#8f5100" },
    "Design.jpg": { "dominant": "#808080", "sidebarBg": "#f0f0f0", "sidebarHover": "#e3e3e3", "circleBg": "#e0e0e0", "circleText": "#721d1d" },
    "music.jpg": { "dominant": "#e0d070", "sidebarBg": "#f5f3ea", "sidebarHover": "#f0ecd6", "circleBg": "#f0ebd1", "circleText": "#75671a" },
    "img_backtoschool.jpg": { "dominant": "#0070c0", "sidebarBg": "#eaf1f5", "sidebarHover": "#d6e5f0", "circleBg": "#d1e3f0", "circleText": "#00538f" },
    "img_bookclub.jpg": { "dominant": "#30b070", "sidebarBg": "#eaf5f0", "sidebarHover": "#d6f0e3", "circleBg": "#d1f0e0", "circleText": "#1d7247" },
    "img_breakfast.jpg": { "dominant": "#ff9060", "sidebarBg": "#f5eeea", "sidebarHover": "#f0ded6", "circleBg": "#f0dad1", "circleText": "#8f2b00" },
    "img_code.jpg": { "dominant": "#507080", "sidebarBg": "#ecf1f3", "sidebarHover": "#dce5e9", "circleBg": "#d9e3e7", "circleText": "#1d5672" },
    "img_gamenight.jpg": { "dominant": "#3060d0", "sidebarBg": "#eaeef5", "sidebarHover": "#d6def0", "circleBg": "#d1daf0", "circleText": "#1a3574" },
    "img_learninstrument.jpg": { "dominant": "#6040b0", "sidebarBg": "#edeaf5", "sidebarHover": "#ddd6f0", "circleBg": "#dad2ef", "circleText": "#351d72" },
    "img_learnlanguage.jpg": { "dominant": "#3060d0", "sidebarBg": "#eaeef5", "sidebarHover": "#d6def0", "circleBg": "#d1daf0", "circleText": "#1a3574" },
    "img_read.jpg": { "dominant": "#507080", "sidebarBg": "#ecf1f3", "sidebarHover": "#dce5e9", "circleBg": "#d9e3e7", "circleText": "#1d5672" }
  };
  window.BANNER_COLOR_MAP = BANNER_COLOR_MAP;

  function getBannerColor(bannerFileName) {
    var key = (bannerFileName || 'WorldHistory.jpg').replace(/^(\.\.\/|\.\/)?images\//, '');
    return BANNER_COLOR_MAP[key] || BANNER_COLOR_MAP['WorldHistory.jpg'];
  }
  window.getBannerColor = getBannerColor;

  try {
    var raw = localStorage.getItem('pinpoint_classroom_config');
    var cfg = raw ? JSON.parse(raw) : null;
    var c = (cfg && (cfg.history || cfg.english)) ? (cfg.history || cfg.english) : null;
    if (!c) c = { name: 'World History', teacher: '', banner: 'WorldHistory.jpg' };

    var name = (c.name || 'World History').trim();
    var teacher = (c.teacher || '').trim();
    var banner = (c.banner || 'WorldHistory.jpg').replace(/^(\.\.\/|\.\/)?images\//, '');

    var isPages = window.location.pathname.includes('/pages/') || window.location.pathname.includes('\\pages\\');
    var isHome = !isPages && (window.location.pathname === '' || window.location.pathname === '/' || window.location.pathname.includes('home') || window.location.pathname.endsWith('home.html') || window.location.pathname.endsWith('index.html'));
    var bannerUrl = (isPages ? '../images/' : './images/') + banner;

    var bannerColors = getBannerColor(banner);
    var letter = (name[0] || 'W').toUpperCase();

    // 1. Immediately sync document.title if on class/classwork page
    var isClasswork = window.location.pathname.includes('classwork');
    if (!isHome && name) {
      var initialTitle = (isClasswork ? ('Classwork for ' + name) : name) + ' - Classroom';
      document.title = initialTitle;
      try {
        if (window.top && window.top !== window.self) {
          window.top.postMessage({ type: 'set-title', title: initialTitle }, '*');
        }
      } catch(e) {}
    }

    // Storage listener to immediately rename tab title if class name changes in another tab
    window.addEventListener('storage', function(e) {
      if (e.key === 'pinpoint_classroom_config') {
        try {
          var updatedCfg = JSON.parse(e.newValue || '{}');
          var updated = (updatedCfg.history || updatedCfg.english || {}).name;
          if (updated && !isHome) {
            var isCw = window.location.pathname.includes('classwork');
            var updatedTitle = (isCw ? ('Classwork for ' + updated) : updated) + ' - Classroom';
            document.title = updatedTitle;
            if (window.top && window.top !== window.self) {
              window.top.postMessage({ type: 'set-title', title: updatedTitle }, '*');
            }
          }
          var updatedBanner = (updatedCfg.history || updatedCfg.english || {}).banner;
          if (updatedBanner) {
            var updatedColors = getBannerColor(updatedBanner);
            var av = document.getElementById('stream-announcement-avatar') || document.querySelector('.JZicYb .Cxyznd.MwOlIe');
            if (av) av.style.setProperty('background-color', updatedColors.circleBg, 'important');
            var ic = document.getElementById('stream-announcement-icon') || document.querySelector('.JZicYb .Cxyznd.MwOlIe .material-symbols-outlined');
            if (ic) {
              ic.style.setProperty('color', updatedColors.circleText, 'important');
              ic.style.setProperty('fill', updatedColors.circleText, 'important');
            }
          }
        } catch(err) {}
      }
    });

    // 2. Inject early CSS rules: remove home banner tint, dynamically color letter icon from banner
    var css = '';
    // Remove dark/color tint overlay from home card banner
    css += '.Tc9hUd .ZizeYd, .Tc9hUd .ZizeYd.ml1ZL, .Tc9hUd .lmPo4 { display: none !important; opacity: 0 !important; } ';
    // Banner background
    css += '.PFLqgc.KFl4Z, .OjOEXb { background-image: url("' + bannerUrl + '") !important; } ';
    // Sidebar circular icon background behind letter
    css += 'nav.STek2d .JShLh, .sidebar .JShLh, .kWQ5wd .JShLh { background-color: ' + bannerColors.circleBg + ' !important; color: ' + bannerColors.circleText + ' !important; } ';
    // Stream announcement megaphone icon & background
    css += '#stream-announcement-avatar, .JZicYb .Cxyznd.MwOlIe { background-color: ' + bannerColors.circleBg + ' !important; } ';
    css += '#stream-announcement-icon, .JZicYb .Cxyznd.MwOlIe .material-symbols-outlined { color: ' + bannerColors.circleText + ' !important; fill: ' + bannerColors.circleText + ' !important; } ';
    
    var head = document.head || document.getElementsByTagName('head')[0];
    if (head) {
      var styleEl = document.createElement('style');
      styleEl.id = 'pinpoint-fast-cache-style';
      styleEl.textContent = css;
      head.appendChild(styleEl);
    }

    // 3. Fast node patcher
    function patchNode(node) {
      if (!node || node.nodeType !== 1) return;
      var cl = node.classList;

      // Class Title in Page / Card / Breadcrumb
      if (cl && (cl.contains('tNGpbb') || cl.contains('ScpeUc') || node.id === 'UGb2Qe')) {
        if (node.textContent !== name) node.textContent = name;
      }

      // Teacher Name in Card
      if (cl && cl.contains('z07MGc') && cl.contains('jJIbcc')) {
        if (node.textContent !== teacher) node.textContent = teacher;
      }

      // Sidebar class name link
      if (cl && cl.contains('YVvGBb')) {
        var p = node.closest ? node.closest('a[data-id="854642477833"]') : null;
        if (p && node.textContent !== name) {
          node.textContent = name;
        }
      }

      // Sidebar circular icon
      if (cl && cl.contains('JShLh')) {
        if (node.textContent !== letter) node.textContent = letter;
        node.style.setProperty('background-color', bannerColors.circleBg, 'important');
        node.style.setProperty('color', bannerColors.circleText, 'important');
      }

      // Stream announcement megaphone icon & background
      if ((cl && cl.contains('Cxyznd') && cl.contains('MwOlIe')) || node.id === 'stream-announcement-avatar') {
        node.style.setProperty('background-color', bannerColors.circleBg, 'important');
        var ico = node.querySelector('.material-symbols-outlined') || node.querySelector('#stream-announcement-icon');
        if (ico) {
          ico.style.setProperty('color', bannerColors.circleText, 'important');
          ico.style.setProperty('fill', bannerColors.circleText, 'important');
        }
      }
      if (node.id === 'stream-announcement-icon') {
        node.style.setProperty('color', bannerColors.circleText, 'important');
        node.style.setProperty('fill', bannerColors.circleText, 'important');
      }

      // Banner background
      if (cl && (cl.contains('PFLqgc') || cl.contains('OjOEXb'))) {
        node.style.backgroundImage = 'url("' + bannerUrl + '")';
      }
    }

    // 4. MutationObserver for fast parsing interception before paint
    var observer = new MutationObserver(function(mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        for (var j = 0; j < m.addedNodes.length; j++) {
          var n = m.addedNodes[j];
          if (n.nodeType === 1) {
            patchNode(n);
            if (n.querySelectorAll) {
              var targets = n.querySelectorAll('.tNGpbb, .ScpeUc, #UGb2Qe, .z07MGc, .PFLqgc, .OjOEXb, .JShLh, .YVvGBb');
              for (var k = 0; k < targets.length; k++) {
                patchNode(targets[k]);
              }
            }
          }
        }
      }
    });

    observer.observe(document.documentElement, { childList: true, subtree: true });

    document.addEventListener('DOMContentLoaded', function() {
      // Final pass on existing DOM
      document.querySelectorAll('.tNGpbb, .ScpeUc, #UGb2Qe, .z07MGc, .PFLqgc, .OjOEXb, .JShLh, .YVvGBb').forEach(patchNode);
      setTimeout(function() {
        observer.disconnect();
      }, 500);
    });
  } catch (e) {
    console.error('Fast cache initialization error:', e);
  }
})();
