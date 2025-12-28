import React from "react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

const SEARCH_MARKUP = `
<div class="relative flex h-full min-h-screen w-full flex-col overflow-x-hidden pb-24 bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-white antialiased selection:bg-primary selection:text-white">
  <div class="h-12 w-full"></div>
  <div class="px-4 pb-2 pt-2 sticky top-0 z-30 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md transition-all duration-300">
    <div class="flex flex-col gap-4">
      <label class="group flex items-center h-12 w-full rounded-2xl bg-white dark:bg-surface-dark px-4 shadow-sm ring-1 ring-slate-200 dark:ring-transparent focus-within:ring-2 focus-within:ring-primary transition-all">
        <span class="material-symbols-outlined text-slate-400 dark:text-text-secondary">search</span>
        <input class="flex-1 bg-transparent border-none focus:ring-0 text-base placeholder:text-slate-400 dark:placeholder:text-text-secondary text-slate-900 dark:text-white px-3 font-normal" placeholder="Search movies, shows, people..." type="text" />
        <button class="flex items-center justify-center text-slate-400 dark:text-text-secondary hover:text-primary transition-colors">
          <span class="material-symbols-outlined">tune</span>
        </button>
      </label>
      <div class="flex gap-2 overflow-x-auto hide-scrollbar pb-2">
        <button class="flex h-9 shrink-0 items-center justify-center rounded-2xl bg-primary px-5 transition-transform active:scale-95">
          <p class="text-white text-sm font-medium">All</p>
        </button>
        <button class="flex h-9 shrink-0 items-center justify-center rounded-2xl bg-slate-200 dark:bg-surface-dark px-5 transition-transform active:scale-95">
          <p class="text-slate-700 dark:text-white text-sm font-medium">Movies</p>
        </button>
        <button class="flex h-9 shrink-0 items-center justify-center rounded-2xl bg-slate-200 dark:bg-surface-dark px-5 transition-transform active:scale-95">
          <p class="text-slate-700 dark:text-white text-sm font-medium">Series</p>
        </button>
        <button class="flex h-9 shrink-0 items-center justify-center rounded-2xl bg-slate-200 dark:bg-surface-dark px-5 transition-transform active:scale-95">
          <p class="text-slate-700 dark:text-white text-sm font-medium">People</p>
        </button>
        <button class="flex h-9 shrink-0 items-center justify-center rounded-2xl bg-slate-200 dark:bg-surface-dark px-5 transition-transform active:scale-95">
          <p class="text-slate-700 dark:text-white text-sm font-medium">News</p>
        </button>
      </div>
    </div>
  </div>
  <div class="flex flex-col pt-6">
    <div class="flex items-center justify-between px-4 pb-4">
      <h2 class="text-xl md:text-2xl font-semibold leading-tight tracking-tight font-body">Friends Are Watching</h2>
      <button class="text-sm font-medium text-primary hover:text-primary/80">See All</button>
    </div>
    <div class="grid grid-cols-2 gap-4 px-4">
      <div class="flex flex-col gap-2 group cursor-pointer relative">
        <div class="relative w-full aspect-[2/3] rounded-[20px] overflow-hidden shadow-lg transition-transform duration-300 group-hover:scale-105">
          <div class="absolute inset-0 bg-cover bg-center" data-alt="Futuristic desert landscape movie poster with orange tones" style='background-image: url("https://lh3.googleusercontent.com/aida-public/AB6AXuCfZZ5IbUHRFel6J0_S7jj8Ip6Re8762mC3DSFkq3MBou1jEFuArEPgWZ8jFQh24gpvzo0mngIMS5pDdz91owRqm8V1evjjaOaj_Jb6N_62wQ8FW3jVwryQllUjubqHpMQo1k8l6Cm7r2uhaFHyftbfrk1nCd7GXvZn0AzoTpKb4-HR25i9THQY6WL1loZQ06_y8Ii7s7LJVLogqb33pIINpkWcddIHfLSADfiDyYX6xayStw3834Go-XA-7RsImR6yfpZJWmvUgZI");'></div>
          <div class="absolute inset-0 bg-gradient-to-t from-orange-900/40 via-transparent to-transparent"></div>
          <div class="absolute inset-0 bg-gradient-to-t from-orange-900/30 via-transparent to-transparent"></div>
          <div class="absolute top-2 right-2 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded-full flex items-center gap-1">
            <span class="material-symbols-outlined text-yellow-400 text-[14px]" style="font-variation-settings: 'FILL' 1;">star</span>
            <span class="text-xs font-bold text-white">8.4</span>
          </div>
          <div class="absolute bottom-2 left-2 flex -space-x-2">
            <img alt="Friend's profile picture" class="w-8 h-8 rounded-full border-2 border-background-dark object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuB6sQUfb_z-QI2PowEAyBM3F71bcRgTd8ZlTkBjqTM_t5T77xFr2oqzHXQJetYoc5lne858U977_vwkGpYg-NyYM2xu5pKq2hlWt6EmoiejiksEsA389PSixa60UXZBmIWJwXma2Sd-OUEI7CONNe27gNxFoivxWQWAVymhmR8D4Eum0azez0z9a4TpCIAwGmaREKeVTS-7KR5wR3zzyTi_Mg0QlHc55YFXUemHVx4QD1madfSzVULI8i9ixuegxMQjKfUPLHpbCjE" />
            <img alt="Friend's profile picture" class="w-8 h-8 rounded-full border-2 border-background-dark object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDFYKU3GXvf7jFdwP0G16dFeeJ_tb9SxLY8bLDoBBMTxtMw_RJD3kX9oNEjWlf3MCocBUfUsrLz-zX_iklGZ3rZAur-tmj5qrWe-4SY34CBc60OEQh97Kt6DA1d3Dr3kUyvnlUp2vO7nqNQXi75Q2H7-akuifJtcq6y0whb2kSvX7mzz8zhc2Mz7ncxZrg2U5m7-hgI_mbPcAr9eomxjuoCMsQcCfPNww-UCPedf6Q4AYdsC4Ffx9nf2cCVHqRWCR17S3kx7dJ08Lk" />
            <div class="w-8 h-8 rounded-full border-2 border-background-dark bg-background-dark flex items-center justify-center text-xs font-semibold text-white/70">+3</div>
          </div>
        </div>
        <div class="pt-1">
          <p class="text-base font-medium leading-tight truncate">Dune: Part Two</p>
          <div class="flex items-center gap-1 mt-1 text-text-secondary text-xs font-semibold">
            <span class="material-symbols-outlined text-[14px]">visibility</span>
            <span>23k views this week</span>
          </div>
        </div>
      </div>
      <div class="flex flex-col gap-2 group cursor-pointer relative">
        <div class="relative w-full aspect-[2/3] rounded-[20px] overflow-hidden shadow-lg transition-transform duration-300 group-hover:scale-105">
          <div class="absolute inset-0 bg-cover bg-center" data-alt="Dramatic chef in kitchen environment poster" style='background-image: url("https://lh3.googleusercontent.com/aida-public/AB6AXuDRZUu67k7y9n1fi3SGJQW-wzw1J9shCsqWRAy-9Rcc-nH79-l9rsB9d9fnFiOl4yswfuslAQZ_CA8qq-7Bfw_aaaPQjgikVp9izi30y5SJMzPv5Bj3agGAcwuFB3vFAwt_9m27uN-mlr0SWDktQpLRXJiS1UPlee9khyYBhQD4-c04hKd6n2UfmmQwHJ1FCg5NRFNcYfkVbT-unDMZ0z4qi11sqM7NDTyRx6CW-lfZChXam6ez2hbHrAEkXOgBgEkZh5RN389MBvw");'></div>
          <div class="absolute inset-0 bg-gradient-to-t from-orange-900/40 via-transparent to-transparent"></div>
          <div class="absolute inset-0 bg-gradient-to-t from-orange-900/30 via-transparent to-transparent"></div>
          <div class="absolute top-2 right-2 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded-full flex items-center gap-1">
            <span class="material-symbols-outlined text-yellow-400 text-[14px]" style="font-variation-settings: 'FILL' 1;">star</span>
            <span class="text-xs font-bold text-white">9.1</span>
          </div>
          <div class="absolute bottom-2 left-2 flex -space-x-2">
            <img alt="Friend's profile picture" class="w-8 h-8 rounded-full border-2 border-background-dark object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDdzdQJ9YO8eFga3dLBbeZXiFYlKqbEyGyJtgN_Fa1sNev5qLGI8wGMwFa5qixK-rVSES4nu8pKJ2zN8bF324gBP-ZIfZaehUoY8AGziur5YqMQYqTuux6obbJKJLWXEAEVCGN07haci32HfaZAtKFAxshRZzJu-V2vnfF_MvtuXwPh_5CA5HlLu5WLD_GJ2u2SbQYapi13dN9hzcB2tSOajXhRyUVqtzMbSuUAWli9yjFkb0jELT7wL5cbnhbUW4pZCpZbpVyIfLY" />
            <img alt="Friend's profile picture" class="w-8 h-8 rounded-full border-2 border-background-dark object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuA7-zhDOBmjAHTxGqeArHp62aIE-Y6i6tZbGkoj6sFP3c1ICFw3cqGOBPWlBwac3CJIGoThMg1jvL4UscA54kcWAp_PerTzZ7ZObFIdb00YeKzCyqim4rzTgZYZX9JCIowTVjHssjfbDysyEPe7I98qHj2apRik-sMeoRw5J4KvlMLC708Ni6n4ML0s5HjsZXnrWJyrZQAa5AKlIDaJQsZkVgIAxhJIzifEL1YIFTs8SAYAAaJ3rXFYTlxQCCUpECK1F7Q7UJX32lE" />
          </div>
        </div>
        <div class="pt-1">
          <p class="text-base font-medium leading-tight truncate">The Bear</p>
          <div class="flex items-center gap-1 mt-1 text-text-secondary text-xs font-semibold">
            <span class="material-symbols-outlined text-[14px]">group_add</span>
            <span>7 friends added to watchlist</span>
          </div>
        </div>
      </div>
      <div class="flex flex-col gap-2 group cursor-pointer relative">
        <div class="relative w-full aspect-[2/3] rounded-[20px] overflow-hidden shadow-lg transition-transform duration-300 group-hover:scale-105">
          <div class="absolute inset-0 bg-cover bg-center" data-alt="Business men in suits walking in city poster" style='background-image: url("https://lh3.googleusercontent.com/aida-public/AB6AXuCJwKtLoxjZtLVjO3JEC9HOLelORKSa2YComSl0TDZGtTorlymc1PtDuUR6AQUvKtx2pGOlPYf5BpWxx6xbW8X5-aC8X61cp4o3g84WoBi9EvBkLOgJZm9r87ChAzbs4EssvbeKyZIRKksCMDjKLvPz0srUXOJEZShsvvKCKSj0_WP0eyddfTW-CfCX89ZxTdYn4M4Zk8S0_oaqBDxP4GQNXaMAOpacOBlsBneEbjby6Ipa6cQrTVct_xQzRKLlSHnKE160SkOlNqc");'></div>
          <div class="absolute inset-0 bg-gradient-to-t from-orange-900/40 via-transparent to-transparent"></div>
          <div class="absolute inset-0 bg-gradient-to-t from-orange-900/30 via-transparent to-transparent"></div>
          <div class="absolute top-2 right-2 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded-full flex items-center gap-1">
            <span class="material-symbols-outlined text-yellow-400 text-[14px]" style="font-variation-settings: 'FILL' 1;">star</span>
            <span class="text-xs font-bold text-white">8.8</span>
          </div>
          <div class="absolute bottom-2 left-2 flex -space-x-2">
            <img alt="Friend's profile picture" class="w-8 h-8 rounded-full border-2 border-background-dark object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuB6sQUfb_z-QI2PowEAyBM3F71bcRgTd8ZlTkBjqTM_t5T77xFr2oqzHXQJetYoc5lne858U977_vwkGpYg-NyYM2xu5pKq2hlWt6EmoiejiksEsA389PSixa60UXZBmIWJwXma2Sd-OUEI7CONNe27gNxFoivxWQWAVymhmR8D4Eum0azez0z9a4TpCIAwGmaREKeVTS-7KR5wR3zzyTi_Mg0QlHc55YFXUemHVx4QD1madfSzVULI8i9ixuegxMQjKfUPLHpbCjE" />
            <div class="w-8 h-8 rounded-full border-2 border-background-dark bg-background-dark flex items-center justify-center text-xs font-semibold text-white/70">+5</div>
          </div>
        </div>
        <div class="pt-1">
          <p class="text-base font-medium leading-tight truncate">Succession</p>
          <div class="flex items-center gap-1 mt-1 text-text-secondary text-xs font-semibold">
            <span class="material-symbols-outlined text-[14px]">visibility</span>
            <span>15k views this week</span>
          </div>
        </div>
      </div>
      <div class="flex flex-col gap-2 group cursor-pointer relative">
        <div class="relative w-full aspect-[2/3] rounded-[20px] overflow-hidden shadow-lg transition-transform duration-300 group-hover:scale-105">
          <div class="absolute inset-0 bg-cover bg-center" data-alt="Dark superhero mask silhouette poster" style='background-image: url("https://lh3.googleusercontent.com/aida-public/AB6AXuBNdmxdG-ZGuXsAz56EC_npEtFqQAMytWzjo7sioQX_okk1lCH2plKXoXcRCf978ncW5S9BFYyIPPAbQWvc8qUu5XVfAgOR32nPrXrMdcXM-rbc0hlOW2-7H68Bh6wVP4tU1Z9A-WPatutzajShdogf2I1VJPlYbsnaNgjZu11RVKQctM8mh10K1YBwZWQ8pGUWNsXpWRo4eba1bm4k-mhHqPYwEMiEcNl4-H389I8b30qG3zQxfkAAiojRtaV8Rw1h6QJzqOaT_Q8");'></div>
          <div class="absolute inset-0 bg-gradient-to-t from-orange-900/40 via-transparent to-transparent"></div>
          <div class="absolute inset-0 bg-gradient-to-t from-orange-900/30 via-transparent to-transparent"></div>
          <div class="absolute top-2 right-2 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded-full flex items-center gap-1">
            <span class="material-symbols-outlined text-yellow-400 text-[14px]" style="font-variation-settings: 'FILL' 1;">star</span>
            <span class="text-xs font-bold text-white">7.9</span>
          </div>
          <div class="absolute bottom-2 left-2 flex -space-x-2">
            <img alt="Friend's profile picture" class="w-8 h-8 rounded-full border-2 border-background-dark object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDFYKU3GXvf7jFdwP0G16dFeeJ_tb9SxLY8bLDoBBMTxtMw_RJD3kX9oNEjWlf3MCocBUfUsrLz-zX_iklGZ3rZAur-tmj5qrWe-4SY34CBc60OEQh97Kt6DA1d3Dr3kUyvnlUp2vO7nqNQXi75Q2H7-akuifJtcq6y0whb2kSvX7mzz8zhc2Mz7ncxZrg2U5m7-hgI_mbPcAr9eomxjuoCMsQcCfPNww-UCPedf6Q4AYdsC4Ffx9nf2cCVHqRWCR17S3kx7dJ08Lk" />
          </div>
        </div>
        <div class="pt-1">
          <p class="text-base font-medium leading-tight truncate">The Batman</p>
          <div class="flex items-center gap-1 mt-1 text-text-secondary text-xs font-semibold">
            <span class="material-symbols-outlined text-[14px]">group_add</span>
            <span>4 friends added to watchlist</span>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div class="flex flex-col pt-8">
    <div class="flex items-center justify-between px-4 pb-4">
      <h2 class="text-xl md:text-2xl font-semibold leading-tight tracking-tight font-body">Critic Picks</h2>
      <button class="text-sm font-medium text-primary hover:text-primary/80">See All</button>
    </div>
    <div class="flex gap-4 overflow-x-auto hide-scrollbar px-4 pb-4">
      <div class="flex flex-col gap-3 shrink-0 w-64">
        <div class="relative w-full aspect-[16/9] rounded-2xl overflow-hidden shadow-lg">
          <div class="absolute inset-0 bg-cover bg-center" data-alt="Cinematic ocean scene" style='background-image: url("https://lh3.googleusercontent.com/aida-public/AB6AXuC8vFQ34KnFjjFqfA8YVR4rkkFQyQn0Hg93kqfAZZpLOAjeh6XdX1fMsRmH9eTRmF6gCF0AIqL4aQmp0WEp8anC93Qgt4T1Z4aRqs1a4n5pL0X9ASwX8WiRWt6oSjx2uCgvQHFh1XnrGvB0j1utp-uw51c8H9x_krX34hCUsnEc9d9hFqOsPw0WAkRqlV2Ck0f9XJf7a5vMm5w9G7A7k4nKjScwG2SRK0OmfH8Hxawq5gQmVdB0V6RI5_6u4f0Z8d4XnA6U");'></div>
        </div>
        <div>
          <p class="text-base font-semibold leading-tight">The Abyss</p>
          <p class="text-sm text-text-secondary">A stunning deep-sea classic.</p>
        </div>
      </div>
      <div class="flex flex-col gap-3 shrink-0 w-64">
        <div class="relative w-full aspect-[16/9] rounded-2xl overflow-hidden shadow-lg">
          <div class="absolute inset-0 bg-cover bg-center" data-alt="Retro neon city" style='background-image: url("https://lh3.googleusercontent.com/aida-public/AB6AXuDdfvGmY7h9B1pE3nW1hZ9JcKxVbO8QwT4mS1kB2h5s__zJ8nc1GxvZ9NOXw6D4hC2KDznoUuC7D6qQ1n2p__j-vvNn2e6GmQ3Vv1oP9UuI9mZVOVaN1s5PM5f9WxKkUhq6nC7xJ02hRh4gK-yxch13bG9fIx6XvEw");'></div>
        </div>
        <div>
          <p class="text-base font-semibold leading-tight">Neon Drive</p>
          <p class="text-sm text-text-secondary">Stylish cyberpunk thriller.</p>
        </div>
      </div>
    </div>
  </div>
</div>
`;

const SearchPage: React.FC = () => {
  useDocumentTitle("Discover");

  return <div dangerouslySetInnerHTML={{ __html: SEARCH_MARKUP }} />;
};

export default SearchPage;
