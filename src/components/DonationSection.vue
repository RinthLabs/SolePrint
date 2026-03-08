<script setup>
</script>

<template>
  <section id="donate" class="donation">
    <div class="donation-inner">
      <h2>Help Keep SolePrint Free</h2>
      <p class="body">
        This project is free and open source. Your support helps us improve the tools,
        keep the servers running, and expand access to sustainable repair for everyone.
      </p>
      <div class="btn-row">
        <a href="#" class="btn-primary btn-lg">Donate Now</a>
        <a href="#" class="text-link">Learn How Donations Are Used</a>
      </div>
      <p class="note">We use Open Collective for transparent funding.</p>
    </div>
  </section>
</template>

<style scoped>
.donation {
  background: #F0FAF5;
  padding: 80px 24px;
}

.donation-inner {
  max-width: 600px;
  margin: 0 auto;
  text-align: center;
}

h2 {
  font-size: 32px;
  font-weight: 700;
  margin-bottom: 16px;
}

.body {
  font-size: 16px;
  line-height: 1.7;
  color: #4A4A4A;
  margin-bottom: 32px;
}

.btn-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}

.btn-lg {
  padding: 14px 32px;
  font-size: 16px;
}

.text-link {
  font-size: 15px;
  font-weight: 500;
  color: #2ECC8F;
  transition: color 200ms ease;
}

.text-link:hover {
  color: #1FA870;
}

.note {
  font-size: 13px;
  color: #999;
}
</style>
