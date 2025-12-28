import React from "react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

const TITLE_REVIEWS_MARKUP = `
<div class="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-white antialiased selection:bg-primary selection:text-white">
  <div class="relative flex h-full min-h-screen w-full flex-col overflow-x-hidden max-w-md mx-auto shadow-2xl bg-background-light dark:bg-background-dark pb-24">
    <header class="sticky top-0 z-30 flex items-center justify-between p-4 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md transition-colors">
      <button class="flex size-10 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
        <span class="material-symbols-outlined text-2xl">arrow_back</span>
      </button>
      <div class="flex flex-col items-center">
        <h1 class="text-lg font-bold leading-tight tracking-tight">Inception</h1>
        <span class="text-xs text-slate-500 dark:text-slate-400 font-medium">2010 • Sci-Fi</span>
      </div>
      <button class="flex size-10 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
        <span class="material-symbols-outlined text-2xl">more_vert</span>
      </button>
    </header>
    <section class="flex flex-col gap-6 px-5 pt-4 pb-2">
      <div class="flex flex-wrap items-center gap-6">
        <div class="flex flex-col items-center justify-center gap-1 min-w-[100px]">
          <span class="text-6xl font-black tracking-tighter text-slate-900 dark:text-white">8.8</span>
          <div class="flex gap-0.5 text-amber-400">
            <span class="material-symbols-outlined filled text-[20px]" style="font-variation-settings: 'FILL' 1;">star</span>
            <span class="material-symbols-outlined filled text-[20px]" style="font-variation-settings: 'FILL' 1;">star</span>
            <span class="material-symbols-outlined filled text-[20px]" style="font-variation-settings: 'FILL' 1;">star</span>
            <span class="material-symbols-outlined filled text-[20px]" style="font-variation-settings: 'FILL' 1;">star</span>
            <span class="material-symbols-outlined filled text-[20px]" style="font-variation-settings: 'FILL' 1;">star_half</span>
          </div>
          <span class="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">12.4k reviews</span>
        </div>
      </div>
    </section>
    <section class="w-full overflow-x-auto no-scrollbar py-4 pl-5">
      <div class="flex gap-3 pr-5">
        <button class="flex h-9 shrink-0 items-center justify-center rounded-full bg-primary px-5 transition-transform active:scale-95">
          <span class="text-sm font-semibold text-white">Most Recent</span>
        </button>
        <button class="flex h-9 shrink-0 items-center justify-center rounded-full bg-slate-200 dark:bg-surface-dark px-5 transition-transform active:scale-95 hover:bg-slate-300 dark:hover:bg-white/10">
          <span class="text-sm font-medium text-slate-700 dark:text-slate-300">Highest Rated</span>
        </button>
      </div>
    </section>
    <div class="h-px w-full bg-slate-200 dark:bg-surface-dark my-2"></div>
    <main class="flex flex-col gap-6 p-5">
      <article class="flex flex-col gap-3">
        <div class="flex items-start justify-between">
          <div class="flex items-center gap-3">
            <div class="size-10 rounded-full bg-slate-700 bg-cover bg-center shadow-inner" data-alt="Portrait of a young man with glasses" style='background-image: url("https://lh3.googleusercontent.com/aida-public/AB6AXuBiWDTu-4QsCmVhpLnYguC_dD3vda0hCMKuoeUTTNm5jmIEtvXPPa_a3Lz5XoOEXbfVk2loLJlutbgQzsm_eFntxxFRSz98WWCLXDoMG87Y9yX2j24OtBY_l9t_Vfa0qh94ik9pAC1S5PfFEhPrcj4B1q95FQJmdDCc9SY4tOLP_MBEEdl_fJ1l3H7N3upYKNYpJs7MBNaRMdxfDIaehk_C9zv5T80H0CkDu8DbIleYqwkICinFUo6YnWoLboOJDdnQrwAcgNumM20");'></div>
            <div>
              <p class="text-sm font-bold text-slate-900 dark:text-white">MovieBuff99</p>
              <p class="text-xs text-slate-500 dark:text-slate-400">2 hours ago</p>
            </div>
          </div>
          <button class="flex size-7 items-center justify-center rounded-full text-slate-400 hover:bg-black/5 dark:hover:bg-white/10 hover:text-white transition-colors">
            <span class="material-symbols-outlined text-xl">more_horiz</span>
          </button>
        </div>
        <div class="flex gap-0.5 text-amber-400">
          <span class="material-symbols-outlined filled text-[18px]" style="font-variation-settings: 'FILL' 1;">star</span>
          <span class="material-symbols-outlined filled text-[18px]" style="font-variation-settings: 'FILL' 1;">star</span>
          <span class="material-symbols-outlined filled text-[18px]" style="font-variation-settings: 'FILL' 1;">star</span>
          <span class="material-symbols-outlined filled text-[18px]" style="font-variation-settings: 'FILL' 1;">star</span>
          <span class="material-symbols-outlined filled text-[18px]" style="font-variation-settings: 'FILL' 1;">star</span>
        </div>
        <p class="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          Absolute masterpiece. The visual effects are stunning and the story is incredibly layered. Definitely requires a second watch to catch everything Christopher Nolan hid in the details. The score by Hans Zimmer is legendary.
        </p>
      </article>
    </main>
  </div>
</div>
`;

const TitleReviewsPageV2: React.FC = () => {
  useDocumentTitle("Reviews");

  return <div dangerouslySetInnerHTML={{ __html: TITLE_REVIEWS_MARKUP }} />;
};

export default TitleReviewsPageV2;
