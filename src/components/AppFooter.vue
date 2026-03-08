<script setup>
</script>

<template>
  <footer class="app-footer">
    <div class="footer-inner">
      <div class="footer-col">
        <div class="footer-logo">
          <span class="logo-dot"></span>
          <span class="logo-text">SolePrint</span>
        </div>
        <p class="tagline">Repair. Reuse. Rethink.</p>
      </div>

      <div class="footer-col">
        <h4>Navigation</h4>
        <router-link to="/">Home</router-link>
        <router-link to="/upload">Upload</router-link>
        <router-link to="/preview">Preview</router-link>
        <router-link to="/results">Results</router-link>
      </div>

      <div class="footer-col">
        <h4>Connect</h4>
        <div class="social-links">
          <a href="#" aria-label="GitHub">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
            </svg>
          </a>
          <a href="#" aria-label="Twitter / X">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
          </a>
        </div>
      </div>
    </div>

    <div class="footer-bottom">
      <p>SolePrint is open source. Built with love for the planet.</p>
    </div>
  </footer>
</template>

<style scoped>
.app-footer {
  background: #fff;
  border-top: 1px solid #EBEBEB;
  margin-top: 80px;
}

.footer-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 48px 24px 32px;
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  gap: 48px;
}

.footer-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.logo-dot {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #2ECC8F;
}

.logo-text {
  font-size: 18px;
  font-weight: 600;
  color: #1A1A1A;
}

.tagline {
  color: #4A4A4A;
  font-size: 14px;
}

.footer-col h4 {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 12px;
}

.footer-col a {
  display: block;
  font-size: 14px;
  color: #4A4A4A;
  padding: 4px 0;
  transition: color 200ms ease;
}

.footer-col a:hover {
  color: #2ECC8F;
}

.social-links {
  display: flex;
  gap: 16px;
}

.social-links a {
  color: #4A4A4A;
  transition: color 200ms ease;
}

.social-links a:hover {
  color: #2ECC8F;
}

.footer-bottom {
  border-top: 1px solid #EBEBEB;
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px 24px;
}

.footer-bottom p {
  font-size: 13px;
  color: #999;
  text-align: center;
}

@media (max-width: 768px) {
  .footer-inner {
    grid-template-columns: 1fr;
    gap: 32px;
  }
}
</style>
