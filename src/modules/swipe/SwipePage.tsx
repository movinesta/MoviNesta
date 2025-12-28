import React from "react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

const SWIPE_MARKUP = `
<div class="bg-background-light dark:bg-background-dark font-display h-screen w-full overflow-hidden flex flex-col relative text-white selection:bg-primary selection:text-white">
  <div class="absolute inset-0 w-full h-full z-0 pointer-events-none overflow-hidden">
    <div class="absolute top-[-10%] left-[-10%] w-[120%] h-[120%] bg-cover bg-center opacity-20 blur-3xl brightness-50 contrast-125 transform scale-110" data-alt="Blurred abstract background pattern derived from movie poster colors" style='background-image: url("https://lh3.googleusercontent.com/aida-public/AB6AXuDpXc9x_V89F4E2BysZrRxBFg9Y0zPo30bVlc4dM4czdcpSO-A6nihnyqSsH2Uu7uxIUxUhHXuPXN0004pnus3miTUhxFSdCdMoCb7jecuc02MXxPc1MVrR7RAm9CnswjbHPH_X98zvZAKd8Tfu68W-sOg9231GylSJyHcBfFjBQfYRECXXBLBxLO4p--pSd5hlkYWfnRf5aSXuwFtz9MjAfV8tDH7n2eE8z5E_EPdhxe2N5uilIU_UhC-ULSM0w9fM_YJ2Va4JFQ0");'></div>
    <div class="absolute inset-0 bg-background-dark/60"></div>
  </div>
  <div class="relative z-10 flex flex-col h-full w-full max-w-md mx-auto p-4 gap-4">
    <header class="flex items-center justify-between py-2 shrink-0">
      <button class="flex items-center justify-center p-2 rounded-full text-white/80 hover:bg-white/10 hover:text-white transition-colors">
        <span class="material-symbols-outlined text-[28px]">tune</span>
      </button>
      <div class="flex flex-col items-center">
        <span class="text-xs font-semibold tracking-widest text-primary uppercase mb-0.5">Discovery</span>
        <h1 class="text-xl font-bold leading-none tracking-tight">For You</h1>
      </div>
      <button class="relative flex items-center justify-center p-2 rounded-full text-white/80 hover:bg-white/10 hover:text-white transition-colors">
        <span class="material-symbols-outlined text-[28px]">notifications</span>
        <span class="absolute top-2 right-2.5 w-2 h-2 bg-primary rounded-full border-2 border-background-dark"></span>
      </button>
    </header>
    <main class="flex-1 flex flex-col items-center justify-center w-full min-h-0 relative">
      <div class="absolute top-8 w-[90%] h-[calc(100%-2rem)] bg-white/5 rounded-xl border border-white/5 shadow-2xl z-0 scale-95 translate-y-4"></div>
      <div class="absolute top-4 w-[95%] h-[calc(100%-1rem)] bg-white/10 rounded-xl border border-white/5 shadow-2xl z-10 scale-[0.98] translate-y-2"></div>
      <div class="relative w-full h-full bg-[#261933] rounded-xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-20 group border border-white/10 flex flex-col">
        <div class="absolute inset-0 bg-cover bg-center" data-alt="Cinematic movie poster for Dune Part Two featuring desert landscape and characters" style='background-image: url("https://lh3.googleusercontent.com/aida-public/AB6AXuCXeabUKPoRc721M1KI5xCR7a_Qep63zbLv4j2SZXvJbOtyF5dcfyYFNGhPTeUoNnaltLeEJi3j13ajUWmtRjq97WZz8lTkRiTeLI8_Z42x48aTvl5oDfvU3rsudlJA8H2jYU8b7NY3MrK0rF3Bjp8vv365uQSVsQQpMNW8eFfxk3xqJdO2tQJqowKFH7eJfCY4YX19NjoL7vGQ4OCgbz_SQnllKj1jvTUKsMfcML8X2D9ixeJjvNel2_524L6fRcyxsDin19_xcck");'></div>
        <div class="absolute inset-0 bg-gradient-to-t from-background-dark via-background-dark/60 to-transparent pt-20"></div>
        <div class="absolute top-4 left-4 right-4 flex justify-between items-start">
          <div class="flex items-center gap-2 bg-black/40 backdrop-blur-md border border-white/10 pr-4 pl-1 py-1 rounded-full shadow-lg">
            <div class="flex -space-x-2">
              <div class="w-8 h-8 rounded-full border-2 border-[#261933] bg-gray-700 bg-cover" data-alt="User avatar" style='background-image: url("https://lh3.googleusercontent.com/aida-public/AB6AXuDHHyi7YM0qKfbijoG4oekGoyX6aV-PAWtSaCTwANLCqbSqBgdGV5yCsbXPJ3HRn0hX7gDJKbbtUx2zgT8vIgVsuBq4HtAuZlal12s_u3jHc9h59tyxXqoQ3eJdW47wyk-CHrrccGqicMq1tnfUFHDbu6toPLkbFUy8YT6VItar1RBlE6rM4_4fLpKdtHz1QOyKLwbVJzX24__mTUI3MWmJkUycoEdYnt_z_nSUhPuzQJXSUww-XCw4jyp8beOBVpbw0VRVi7pSKVA");'></div>
              <div class="w-8 h-8 rounded-full border-2 border-[#261933] bg-gray-600 flex items-center justify-center text-[10px] font-bold">+4</div>
            </div>
            <span class="text-xs font-medium text-white/90"><span class="text-primary font-bold">Sarah</span> &amp; others watched</span>
          </div>
        </div>
        <div class="mt-auto relative p-6 flex flex-col gap-4 z-10">
          <div>
            <div class="flex items-center gap-2 mb-2">
              <div class="px-3 py-1 rounded-full bg-primary/20 border border-primary/30 backdrop-blur-sm">
                <span class="text-xs font-bold text-primary uppercase tracking-wide">🔥 Trending</span>
              </div>
            </div>
            <h2 class="text-4xl font-bold leading-[1.1] tracking-tight">Dune: Part Two</h2>
            <p class="text-white/50 text-base font-medium mt-1 mb-2">Directed by Denis Villeneuve</p>
            <div class="flex items-center gap-3 text-white/60 text-sm font-medium">
              <span>2024</span>
              <span class="w-1 h-1 rounded-full bg-white/40"></span>
              <span class="text-green-400 font-bold">98% Match</span>
              <span class="w-1 h-1 rounded-full bg-white/40"></span>
              <span class="flex items-center gap-1 text-white/80"><span class="material-symbols-outlined text-base !text-green-400">star</span>8.8</span>
              <span class="w-1 h-1 rounded-full bg-white/40"></span>
              <span>2h 46m</span>
            </div>
          </div>
          <div class="p-3 rounded-2xl bg-white/5 border border-white/5 backdrop-blur-md flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="flex -space-x-3 rtl:space-x-reverse overflow-visible">
                <div class="w-9 h-9 rounded-full border-2 border-background-dark bg-cover bg-center" data-alt="Friend avatar 1" style='background-image: url("https://lh3.googleusercontent.com/aida-public/AB6AXuBMKhchYXH660rA5bOVMzynsOOEwhh9zOG5DVLd_3BSsDOD8fzAdEciCnigjc5zDK8K3DdO47WuWHyJyxzwZkVROxbFVfff_ztatzg8mMnmHQYGdqaABBBWxe2T5E7f6OC8ladvf7mGm0a04bUMrXYyyqeGgQddqGqeyq7EWCBD9gu1lNTjH_4BAGjZpQF2hrprcwKbGNYjemXeYSasft4YylFI9VGmkKb3TzmSJeXsAVHCX8QYz5efE5jcWmR9xJmabhyNrpNXx_c");'></div>
                <div class="w-9 h-9 rounded-full border-2 border-background-dark bg-cover bg-center" data-alt="Friend avatar 2" style='background-image: url("https://lh3.googleusercontent.com/aida-public/AB6AXuABZxd1zZWTILRd0t-KlxTFPSgA4SJbVj_dv7enYg9JrA1nQO0sAOGCdy0567mm_i4QjuJaZZ9SSI88ifVs_ArduzWlkp8wZ-5f4GHnFYNd8HbjjsvN2Tsy0joMh-djtPnHrVePqr6kZAbHWHJEPhb7qcHNmTT89USs305x-Etpv1qbQ4D0-cOLY5FaIv_V1qSrnzEOq-hHGNE7q_aYB52gIUz4YyWT2IY8RfYiiRI4aJxmfjUjsF0kBHcGPLoQmG364eT5z0q6v8k");'></div>
                <div class="w-9 h-9 rounded-full border-2 border-background-dark bg-cover bg-center" data-alt="Friend avatar 3" style='background-image: url("https://lh3.googleusercontent.com/aida-public/AB6AXuBTTeSw9q6An2IloBx023SCrkAuGFu6JsWQ6Oq9IK5PU7D_d2EAIvGVDSbpmW-djdrdPaahlLfgyCFZBIDMAzPHpcRwOVRSe_tE41yTuYtgybNMHVvqvOZgD2MVm2ceQUzHNCOgWC3eOb8LVHNRWc93QmKDoIpnhwiRNDLXG4IeQYBksSzOMPlaVgDzzQedT0jy8J2SP3hUg6GxyvrJWIKfH20rQ_-zkSOL4DNms-x6tXiLwcqV_7rMrudiKSk7sCBo6J9v8v4olTM");'></div>
              </div>
              <div class="flex flex-col">
                <span class="text-sm font-bold text-white leading-tight">80% of friends</span>
                <span class="text-xs text-white/50 leading-tight">liked this movie</span>
              </div>
            </div>
            <button class="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:bg-white/20 transition-colors">
              <span class="material-symbols-outlined text-sm">arrow_forward_ios</span>
            </button>
          </div>
          <div class="flex flex-wrap gap-2">
            <span class="px-4 py-1.5 rounded-full bg-white/10 text-xs font-medium text-white/90 border border-white/5">#Sci-Fi</span>
            <span class="px-4 py-1.5 rounded-full bg-white/10 text-xs font-medium text-white/90 border border-white/5">#Adventure</span>
            <span class="px-4 py-1.5 rounded-full bg-white/10 text-xs font-medium text-white/90 border border-white/5">#Epic</span>
          </div>
        </div>
      </div>
    </main>
    <footer class="shrink-0 pt-6 pb-4 px-4">
      <div class="flex items-center justify-between max-w-[280px] mx-auto">
        <button class="group flex items-center justify-center w-16 h-16 rounded-full bg-[#261933] border border-white/10 shadow-lg active:scale-95 transition-all duration-200">
          <span class="material-symbols-outlined text-4xl text-white/40 group-hover:text-red-400 transition-colors">close</span>
        </button>
        <button class="relative flex items-center justify-center w-20 h-20 rounded-full bg-primary shadow-glow shadow-primary/40 active:scale-95 transition-all duration-200 -mt-2">
          <span class="material-symbols-outlined text-[40px] text-white">bookmark_add</span>
        </button>
        <button class="group flex items-center justify-center w-16 h-16 rounded-full bg-[#261933] border border-white/10 shadow-lg active:scale-95 transition-all duration-200">
          <span class="material-symbols-outlined text-[36px] text-white/40 group-hover:text-green-400 transition-colors fill-current">favorite</span>
        </button>
      </div>
    </footer>
  </div>
</div>
`;

const SwipePage: React.FC = () => {
  useDocumentTitle("Discovery");

  return <div dangerouslySetInnerHTML={{ __html: SWIPE_MARKUP }} />;
};

export default SwipePage;
