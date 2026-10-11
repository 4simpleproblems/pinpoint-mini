/**
 * Fast cache synchronous loader for Pinpoint
 * Eliminates flash of unstyled / default "World History" text and banner
 * Synchronously applies cached class name, teacher, banner, and circle icon.
 */
(function() {
  function getThemeColor(name) {
    var colors = [
      { bg: '#d0e4ff', text: '#04409f', theme: 'Ag4wUb' }, // Blue
      { bg: '#ffdcc3', text: '#9a4600', theme: 'g2MItd' }, // Orange
      { bg: '#beefbb', text: '#006c35', theme: 'WFUiUb' }, // Green
      { bg: '#eedcfe', text: '#5629a4', theme: 'Mupove' }, // Purple
      { bg: '#ffd8ef', text: '#b60d6e', theme: 'zvzLKc' }, // Pink
      { bg: '#acedff', text: '#004f6e', theme: 'S3aLQd' }  // Cyan
    ];
    var hash = 0;
    var key = name || 'World History';
    for (var i = 0; i < key.length; i++) {
      hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
    }
    return colors[hash % colors.length];
  }
  window.getPinpointClassThemeColor = getThemeColor;

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

    var themeColor = getThemeColor(name);
    var letter = (name[0] || 'W').toUpperCase();

    // 1. Immediately sync document.title if on class/classwork page
    if (!isHome && name) {
      document.title = name + ' - Classroom';
    }

    // 2. Inject early CSS rules so layout paints with custom styles immediately
    var css = '';
    css += '.PFLqgc.KFl4Z, .OjOEXb { background-image: url("' + bannerUrl + '") !important; } ';
    css += 'nav.STek2d .JShLh, .sidebar .JShLh, .kWQ5wd .JShLh { background-color: ' + themeColor.bg + ' !important; color: ' + themeColor.text + ' !important; } ';
    
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
        node.style.setProperty('background-color', themeColor.bg, 'important');
        node.style.setProperty('color', themeColor.text, 'important');
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
