
(function(){
  var overlay = document.getElementById('lockOverlay');
  var phoneInput = document.getElementById('phoneInput');
  var errEl = document.getElementById('lockError');
  var loadEl = document.getElementById('lockLoading');
  var btnEl = document.getElementById('verifyBtn');

  // 有效期 1 分钟
  var VALID_MS = 1 * 60 * 1000;
  var relockTimer = null;

  // Enter 键提交（始终绑定，保证重新锁屏后也能用）
  if (phoneInput) {
    phoneInput.addEventListener('keydown', function(e){
      if (e.key === 'Enter') verifyPhone();
    });
  }
  window.verifyPhone = verifyPhone;

  // Check existing session (1 minute)
  var session = null;
  try { session = JSON.parse(localStorage.getItem('phone_session')); } catch(e) {}
  if (session && session.expires && Date.now() < session.expires) {
    if (overlay) overlay.classList.add('hidden');
    scheduleRelock(session.expires);
    return;
  }

  // Show overlay
  if (overlay) overlay.classList.remove('hidden');
  if (phoneInput) phoneInput.focus();

  // SHA-256 hash phone, fetch hash list, compare
  function sha256(str){
    var encoder = new TextEncoder();
    return crypto.subtle.digest('SHA-256', encoder.encode(str))
      .then(function(buf){
        return Array.from(new Uint8Array(buf))
          .map(function(b){ return b.toString(16).padStart(2,'0'); }).join('');
      });
  }

  function verifyPhone(){
    var phone = phoneInput.value.replace(/\s+/g, '');
    if (!phone) { showErr('请输入手机号'); shake(); return; }
    if (!/^1\d{10}$/.test(phone)) { showErr('请输入正确的 11 位手机号'); shake(); return; }

    btnEl.disabled = true;
    loadEl.classList.add('show');
    errEl.classList.remove('show');
    phoneInput.classList.remove('error');

    // 兜底哈希列表：fetch 失败（如本地 file:// 打开）时使用，仅存哈希不存明文
    var FALLBACK_HASHES = [
      '413b7b3d5700ad8a6b296c9d0e7107dbd7280a985c1c695db8646c278e510224',
      '270b0e42fa470c44d366bde6b47de2225e915e5b274f1c3838682e1ca350532f',
      'cbcf800f235bcba864b3fa23d3fb3cfab8eb3806a5ef2da4e9f84b89d0010ab6'
    ];

    function check(phoneHash, hashes){
      var matched = hashes.some(function(h){ return h === phoneHash; });
      loadEl.classList.remove('show');
      btnEl.disabled = false;
      if (matched) {
        unlock(phone);
      } else {
        showErr('输入有误，请重新输入');
        shake();
      }
    }

    // Hash the input, fetch hash list; fallback to embedded list if fetch fails
    sha256(phone).then(function(phoneHash){
      fetch('jiesuo.html').then(function(r){ return r.text(); }).then(function(text){
        var hashes = text.trim().split(/[\n\r]+/).filter(function(h){ return h.trim(); });
        check(phoneHash, hashes);
      }).catch(function(){
        check(phoneHash, FALLBACK_HASHES);
      });
    }).catch(function(){
      loadEl.classList.remove('show');
      btnEl.disabled = false;
      showErr('设备不支持，请更换浏览器');
    });
  };

  function unlock(phone){
    var now = Date.now();
    var expires = now + VALID_MS;
    localStorage.setItem('phone_session', JSON.stringify({
      phone: phone,
      loginAt: now,
      expires: expires
    }));
    if (overlay) {
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity .4s';
      setTimeout(function(){ overlay.classList.add('hidden'); overlay.style.opacity = '1'; }, 400);
    }
    scheduleRelock(expires);
  }

  // 有效期结束后重新锁屏（页面停留期间也会触发）
  function relock(){
    relockTimer = null;
    try { localStorage.removeItem('phone_session'); } catch(e) {}
    if (!overlay) return;
    phoneInput.value = '';
    errEl.classList.remove('show');
    overlay.classList.remove('hidden');
    overlay.style.opacity = '1';
    overlay.style.transition = 'none';
    if (phoneInput) phoneInput.focus();
  }

  function scheduleRelock(expires){
    if (relockTimer) { clearTimeout(relockTimer); relockTimer = null; }
    var remain = expires - Date.now();
    if (remain <= 0) { relock(); return; }
    relockTimer = setTimeout(relock, remain);
  }

  function showErr(msg){
    errEl.textContent = msg;
    errEl.classList.add('show');
    setTimeout(function(){ errEl.classList.remove('show'); }, 3000);
  }

  function shake(){
    phoneInput.classList.add('error');
    setTimeout(function(){ phoneInput.classList.remove('error'); }, 400);
  }
})();
