<script setup>
const cards = [
  {
    icon: `<svg width="32" height="32" viewBox="0 0 32 32" fill="none"><path d="M16 4v24M4 16h24" stroke="#2ECC8F" stroke-width="2.5" stroke-linecap="round"/><circle cx="16" cy="16" r="12" stroke="#2ECC8F" stroke-width="2"/><path d="M10 10l12 12M22 10L10 22" stroke="#2ECC8F" stroke-width="1.5" stroke-linecap="round" opacity="0.4"/></svg>`,
    title: 'Reduce Waste',
    text: '300 million pairs of shoes are thrown away every year in the US alone.'
  },
  {
    icon: `<svg width="32" height="32" viewBox="0 0 32 32" fill="none"><path d="M8 24c0-8 4-12 8-12s8 4 8 12" stroke="#2ECC8F" stroke-width="2" stroke-linecap="round"/><path d="M12 24c0-4 2-6 4-6s4 2 4 6" stroke="#2ECC8F" stroke-width="2" stroke-linecap="round"/><circle cx="16" cy="8" r="3" stroke="#2ECC8F" stroke-width="2"/></svg>`,
    title: 'Reuse What You Own',
    text: 'A worn-out sole does not mean a worn-out shoe. Most uppers still have years of life left.'
  },
  {
    icon: `<svg width="32" height="32" viewBox="0 0 32 32" fill="none"><path d="M6 16h20M6 16l4-4M6 16l4 4M26 16l-4-4M26 16l-4 4" stroke="#2ECC8F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><rect x="13" y="10" width="6" height="12" rx="2" stroke="#2ECC8F" stroke-width="2"/></svg>`,
    title: 'Extend Product Life',
    text: 'Replacing a sole costs a fraction of a new shoe and keeps quality materials out of landfill.'
  },
  {
    icon: `<svg width="32" height="32" viewBox="0 0 32 32" fill="none"><path d="M16 4l3 6h7l-5.5 4.5 2 7L16 17l-6.5 4.5 2-7L6 10h7l3-6z" stroke="#2ECC8F" stroke-width="2" stroke-linejoin="round"/></svg>`,
    title: 'Support Sustainable Making',
    text: 'SolePrint is built by makers, for makers. Open tools for a circular economy.'
  }
]
</script>

<template>
  <section id="mission" class="mission">
    <div class="mission-inner">
      <h2>Why SolePrint Exists</h2>
      <div class="cards-grid">
        <div v-for="(card, i) in cards" :key="i" class="card">
          <div class="card-icon" v-html="card.icon"></div>
          <h3>{{ card.title }}</h3>
          <p>{{ card.text }}</p>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.mission {
  padding: 80px 24px;
}

.mission-inner {
  max-width: 960px;
  margin: 0 auto;
  text-align: center;
}

h2 {
  font-size: 36px;
  font-weight: 700;
  margin-bottom: 48px;
  letter-spacing: -0.01em;
}

.cards-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}

.card {
  background: #fff;
  border-radius: 16px;
  padding: 36px 28px;
  box-shadow: 0 2px 16px rgba(0,0,0,0.06);
  text-align: left;
  transition: transform 200ms ease, box-shadow 200ms ease;
}

.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 24px rgba(0,0,0,0.08);
}

.card-icon {
  margin-bottom: 16px;
}

h3 {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 8px;
}

.card p {
  font-size: 15px;
  line-height: 1.6;
  color: #4A4A4A;
}

@media (max-width: 768px) {
  .cards-grid {
    grid-template-columns: 1fr;
  }
  h2 {
    font-size: 28px;
  }
}
</style>
