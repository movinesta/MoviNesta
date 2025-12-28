import React from "react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

const TITLE_DETAIL_MARKUP = `
<div class="bg-background-light dark:bg-background-dark text-slate-900 dark:text-white font-display antialiased selection:bg-primary/30">
  <div class="relative min-h-screen w-full flex flex-col overflow-x-hidden">
    <div class="absolute top-0 left-0 w-full h-[65vh] z-0">
      <div class="w-full h-full bg-center bg-cover bg-no-repeat" data-alt="Cinematic movie scene with dark moody lighting and a spaceship" style='background-image: url("https://lh3.googleusercontent.com/aida-public/AB6AXuBYvt3RK03JnGW9k0SrGaz824UwtuIIdRP6B579XfWnmE2A1rE360L1oo-AjHTfL8ldqsOVeWymYPrEutt-zEvwIBy0lQiE01i-Atorxmm21ahHgEQDXpUsAS_JZw1bMCvF0Hw7CrKf-7VLJymbkB_IDhr60Y-CwfpdOqbZGbf4AkfScFrSdBAHwAEDxYNxR5E08bGOaIamutJbbwBIs4SXVl0pDXfb9BZHsaQY-hIHevJTfVOhiHY0bYLz320aKaXL1g4NPogs7mU");'>
      </div>
      <div class="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-background-dark"></div>
      <div class="absolute inset-0 bg-gradient-to-t from-background-dark via-background-dark/60 to-transparent"></div>
    </div>
    <div class="fixed top-0 w-full z-50 p-4 pt-12 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent">
      <button class="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/10 backdrop-blur-md text-white hover:bg-white/20 transition-colors">
        <span class="material-symbols-outlined">arrow_back</span>
      </button>
      <div class="flex gap-3">
        <button class="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/10 backdrop-blur-md text-white hover:bg-white/20 transition-colors">
          <span class="material-symbols-outlined">favorite</span>
        </button>
        <button class="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/10 backdrop-blur-md text-white hover:bg-white/20 transition-colors">
          <span class="material-symbols-outlined">more_vert</span>
        </button>
      </div>
    </div>
    <main class="relative z-10 mt-[45vh] px-4 pb-20">
      <div class="flex flex-col items-center text-center mb-6">
        <div class="mb-4 relative group">
          <div class="absolute -inset-1 rounded-full bg-primary blur opacity-40 group-hover:opacity-60 transition duration-200"></div>
          <div class="relative flex items-center justify-center size-16 rounded-full bg-[#2a1f36] border-2 border-primary">
            <span class="text-lg font-bold text-white">4.8</span>
          </div>
        </div>
        <h1 class="text-white text-4xl font-bold leading-tight tracking-tight mb-2">Interstellar</h1>
        <div class="flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm text-gray-300 font-medium mb-6">
          <span>2014</span>
          <span class="size-1 rounded-full bg-gray-500 self-center"></span>
          <span>2h 49m</span>
          <span class="size-1 rounded-full bg-gray-500 self-center"></span>
          <span>PG-13</span>
        </div>
        <div class="flex gap-2 flex-wrap justify-center mb-8">
          <div class="flex h-8 items-center justify-center rounded-full bg-white/10 border border-white/5 px-4 backdrop-blur-sm">
            <p class="text-white text-xs font-medium uppercase tracking-wide">Sci-Fi</p>
          </div>
          <div class="flex h-8 items-center justify-center rounded-full bg-white/10 border border-white/5 px-4 backdrop-blur-sm">
            <p class="text-white text-xs font-medium uppercase tracking-wide">Adventure</p>
          </div>
          <div class="flex h-8 items-center justify-center rounded-full bg-white/10 border border-white/5 px-4 backdrop-blur-sm">
            <p class="text-white text-xs font-medium uppercase tracking-wide">Drama</p>
          </div>
        </div>
        <div class="w-full max-w-sm flex gap-3">
          <button class="flex-1 h-14 bg-primary hover:bg-primary/90 active:scale-95 transition-all rounded-full flex items-center justify-center gap-2 text-white font-bold text-base shadow-lg shadow-primary/25">
            <span class="material-symbols-outlined fill-current">play_circle</span>
            Play Trailer
          </button>
          <button class="size-14 bg-[#302839] hover:bg-[#3d3349] active:scale-95 transition-all rounded-full flex items-center justify-center text-white">
            <span class="material-symbols-outlined">bookmark_add</span>
          </button>
          <button class="size-14 bg-[#302839] hover:bg-[#3d3349] active:scale-95 transition-all rounded-full flex items-center justify-center text-white">
            <span class="material-symbols-outlined">share</span>
          </button>
        </div>
      </div>
      <div class="mb-8 pt-4">
        <h3 class="text-lg font-bold text-white mb-3 px-1">Storyline</h3>
        <p class="text-gray-300 text-base leading-relaxed px-1 leading-normal">
          Earth's future has been riddled by disasters, famines, and droughts. There is only one way to ensure mankind's survival: Interstellar travel. A newly discovered wormhole in the far reaches of our solar system allows a team of astronauts to go where no man has gone before.
        </p>
      </div>
      <div class="w-full h-px bg-white/5 -mx-4 mb-8"></div>
      <div class="mb-8">
        <div class="flex justify-between items-end mb-4 px-1">
          <h3 class="text-lg font-bold text-white">Cast & Crew</h3>
          <button class="text-primary text-sm font-semibold">See all</button>
        </div>
        <div class="flex gap-4 overflow-x-auto pb-4 snap-x no-scrollbar -mx-4 px-4">
          <div class="flex flex-col items-center gap-2 shrink-0 snap-start">
            <div class="size-20 rounded-full overflow-hidden bg-gray-700">
              <img alt="Portrait of Matthew McConaughey" class="w-full h-full object-cover" data-alt="Matthew McConaughey headshot" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCX4jl7Ukjbr27a5-VCVZwG0Sv4ZKHqBPenR5_uSYWwKeHiMl7NWDKgw5Sc-caFSANQ4Ls9CmjF3c56cnrw0Vjvb_6BoKatyVUuezsflNwzpMgzcYTT2JQ0n-UvgzoZvhiHgpAfeT_84EhfuD3Dorjl_bwC5KlO0GToP7DEP_kJ8Rk4v3hFyD0115v6W4ORMtjA7-QH8RB67DD-r5QQtx8QeXQjvfSp_iPkAB49jWpBzFDerP9dmBknqsT9gN9VD2FtxFhHKnReIGA" />
            </div>
            <div class="text-center">
              <p class="text-white text-xs font-semibold">Matthew M.</p>
              <p class="text-gray-400 text-[10px]">Cooper</p>
            </div>
          </div>
        </div>
      </div>
      <div class="w-full h-px bg-white/5 -mx-4 mb-8"></div>
      <div class="bg-[#211a29] -mx-4 px-4 py-8 rounded-t-3xl mt-4">
        <h3 class="text-lg font-bold text-white mb-6">Ratings & Reviews</h3>
        <div class="flex flex-wrap gap-6 mb-8">
          <div class="flex flex-col justify-center gap-1">
            <p class="text-white text-5xl font-black leading-none tracking-tight">4.8</p>
            <div class="flex gap-0.5 text-primary">
              <span class="material-symbols-outlined text-sm" style="font-variation-settings: 'FILL' 1;">star</span>
              <span class="material-symbols-outlined text-sm" style="font-variation-settings: 'FILL' 1;">star</span>
              <span class="material-symbols-outlined text-sm" style="font-variation-settings: 'FILL' 1;">star</span>
              <span class="material-symbols-outlined text-sm" style="font-variation-settings: 'FILL' 1;">star</span>
              <span class="material-symbols-outlined text-sm" style="font-variation-settings: 'FILL' 1;">star_half</span>
            </div>
            <p class="text-gray-400 text-xs mt-1">1.2k verified reviews</p>
          </div>
          <div class="flex-1 grid grid-cols-[12px_1fr_30px] items-center gap-x-3 gap-y-2">
            <p class="text-white text-xs font-medium">5</p>
            <div class="flex h-1.5 flex-1 overflow-hidden rounded-full bg-[#3d3349]">
              <div class="rounded-full bg-primary" style="width: 80%;"></div>
            </div>
            <p class="text-gray-400 text-xs text-right">80%</p>
          </div>
        </div>
        <div class="flex flex-col gap-4">
          <div class="p-4 rounded-2xl bg-[#302839] hover:bg-[#382f42] transition-colors">
            <div class="flex justify-between items-start mb-3">
              <div class="flex items-center gap-3">
                <div class="size-9 rounded-full bg-gray-700 bg-cover bg-center" style='background-image: url("https://lh3.googleusercontent.com/aida-public/AB6AXuBiWDTu-4QsCmVhpLnYguC_dD3vda0hCMKuoeUTTNm5jmIEtvXPPa_a3Lz5XoOEXbfVk2loLJlutbgQzsm_eFntxxFRSz98WWCLXDoMG87Y9yX2j24OtBY_l9t_Vfa0qh94ik9pAC1S5PfFEhPrcj4B1q95FQJmdDCc9SY4tOLP_MBEEdl_fJ1l3H7N3upYKNYpJs7MBNaRMdxfDIaehk_C9zv5T80H0CkDu8DbIleYqwkICinFUo6YnWoLboOJDdnQrwAcgNumM20");'></div>
                <div>
                  <p class="text-white text-sm font-semibold">MovieBuff99</p>
                  <p class="text-gray-400 text-xs">2 hours ago</p>
                </div>
              </div>
              <div class="flex gap-0.5 text-primary">
                <span class="material-symbols-outlined text-sm" style="font-variation-settings: 'FILL' 1;">star</span>
                <span class="material-symbols-outlined text-sm" style="font-variation-settings: 'FILL' 1;">star</span>
                <span class="material-symbols-outlined text-sm" style="font-variation-settings: 'FILL' 1;">star</span>
                <span class="material-symbols-outlined text-sm" style="font-variation-settings: 'FILL' 1;">star</span>
                <span class="material-symbols-outlined text-sm" style="font-variation-settings: 'FILL' 1;">star</span>
              </div>
            </div>
            <p class="text-gray-300 text-sm leading-relaxed">
              Absolute masterpiece. The visuals and sound design are breathtaking, and the emotional depth hits on every rewatch.
            </p>
          </div>
        </div>
      </div>
    </main>
  </div>
</div>
`;

const TitleDetailPageV2: React.FC = () => {
  useDocumentTitle("Title Details");

  return <div dangerouslySetInnerHTML={{ __html: TITLE_DETAIL_MARKUP }} />;
};

export default TitleDetailPageV2;
