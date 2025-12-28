import React from "react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

const HOME_MARKUP = `
<div class="sticky top-0 z-50 w-full bg-background-light/90 dark:bg-background-dark/90 backdrop-blur-md border-b border-gray-200 dark:border-white/5">
  <div class="flex items-center p-4 justify-between max-w-lg mx-auto">
    <div class="flex items-center gap-3">
      <div class="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10 ring-2 ring-primary/20" data-alt="User profile portrait showing a smiling young man" style='background-image: url("https://lh3.googleusercontent.com/aida-public/AB6AXuACTwNdEisStfCZahQb_qOVcYnNceMcehOb_2_CzCT7Z9n_ua1cvuyFZIvPwekx4Wuq3gob3FkOx4nvqPs4b2sK3wgnPKJJpIAm66WTjvQZqoIwR0PR48hUvF4w1PAUDWtlMd-LeNP-xbe0ei-4Ihi0Zz1BcpNBB20wH7Ur9hu4q6-_V9D4Dgt6JpmtEVPmAgn0SGCWWok8jj626C9c2lgXokelURrLZT__CKcQgM3OkluDX3xGABCcsAnzjpaO_eZgywF6SYoHCdQ");'></div>
      <div class="flex flex-col">
        <span class="text-xs text-gray-500 dark:text-gray-400 font-medium">Good Evening</span>
        <h2 class="text-gray-900 dark:text-white text-lg font-bold leading-none tracking-tight">Alex</h2>
      </div>
    </div>
    <div class="flex items-center gap-2">
      <button class="flex items-center justify-center rounded-full size-10 hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
        <span class="material-symbols-outlined text-gray-900 dark:text-white" style="font-size: 24px;">search</span>
      </button>
      <button class="flex items-center justify-center rounded-full size-10 hover:bg-black/5 dark:hover:bg-white/10 transition-colors relative">
        <span class="material-symbols-outlined text-gray-900 dark:text-white" style="font-size: 24px;">notifications</span>
        <span class="absolute top-2 right-2 size-2 bg-primary rounded-full"></span>
      </button>
    </div>
  </div>
</div>
<div class="max-w-lg mx-auto w-full flex flex-col gap-6">
  <div class="w-full pt-2">
    <div class="px-4 pb-2">
      <h3 class="text-gray-900 dark:text-white text-sm font-bold tracking-wide uppercase opacity-70">Happening Now</h3>
    </div>
    <div class="flex w-full overflow-x-auto no-scrollbar px-4 py-1 gap-4">
      <div class="flex flex-col items-center gap-2 min-w-[64px]">
        <div class="flex items-center justify-center size-16 rounded-full border-2 border-dashed border-gray-400 dark:border-gray-600 bg-transparent">
          <span class="material-symbols-outlined text-gray-400 dark:text-gray-500">add</span>
        </div>
        <p class="text-gray-600 dark:text-gray-400 text-xs font-medium truncate w-16 text-center">Add New</p>
      </div>
      <div class="flex flex-col items-center gap-2 min-w-[64px]">
        <div class="p-[2px] rounded-full bg-gradient-to-tr from-primary to-[#c084fc]">
          <div class="size-[60px] bg-center bg-no-repeat bg-cover rounded-full border-2 border-background-light dark:border-background-dark" data-alt="Portrait of Sarah smiling outdoors" style='background-image: url("https://lh3.googleusercontent.com/aida-public/AB6AXuBSZ185s5OsR6dhv2ZGmP25f_Qua7HjTcWeyMDJnR0O95c_OrAiepoJsg0b-NVPyBjPAVrPeVw7CC7EMMjzob4virUfc1yGammSs9FYN0bjqjRa0-OL5QE9H_OJewEbS0afRIspjvIaPumCJDtiRsxa_CuYX7k4ioeUwIB-kRmRlSXGYoHA75D3ak_m4JSSNboSb8c0DDvf_qRRElJgzlKdzo8zOA18vYjTLlPEJP3USymzEW5f6S5IuBnkZ2ISVpCalmEj-Tu8Aio");'></div>
        </div>
        <p class="text-gray-900 dark:text-white text-xs font-medium truncate w-16 text-center">Sarah</p>
      </div>
      <div class="flex flex-col items-center gap-2 min-w-[64px]">
        <div class="p-[2px] rounded-full bg-gradient-to-tr from-primary to-[#c084fc]">
          <div class="size-[60px] bg-center bg-no-repeat bg-cover rounded-full border-2 border-background-light dark:border-background-dark" data-alt="Portrait of Mike wearing glasses" style='background-image: url("https://lh3.googleusercontent.com/aida-public/AB6AXuB1BZ81LT2WBhtGLFd1SFy_vE0E9Oqdg0u5EYamhR9XmqQaV3gif10Ag33z5rPYo7JK2y9rgt1ZtTqdr8XQYlmQURH1cJg4Uk7ELTZ3HW8ndXBkslTyx2S8yQ5A-UGqelplHOQ5EPay0G7HnxZ5j8bpyJHkeNEpRbK3Y10ANYXeYM-25o4yO9iNxakp5JJPSTTPvdba6KIggd88MXVpVSTyU8m59PEnIxrMlp8Chrds9RqOiWZmBMeQMHiJJml1XwByRn9Ukrf9VOw");'></div>
        </div>
        <p class="text-gray-900 dark:text-white text-xs font-medium truncate w-16 text-center">Mike</p>
      </div>
      <div class="flex flex-col items-center gap-2 min-w-[64px]">
        <div class="p-[2px] rounded-full bg-gray-300 dark:bg-gray-700">
          <div class="size-[60px] bg-center bg-no-repeat bg-cover rounded-full border-2 border-background-light dark:border-background-dark" data-alt="Portrait of Jessica looking at camera" style='background-image: url("https://lh3.googleusercontent.com/aida-public/AB6AXuBnIMB0SMEl3HanVozcpVS409PgPJGu0pq5tdNrVvuTyuuLLTnFWcn9lMhIlS17b7hekjhnDaFwy0UXjouaiUlFCU1xr_-gZ6c2bqtpgOR8LOMLeNpmDMfIObVHnxwJ7aF2fO8ZLb4GBBPy72Sb4M0fdbe3kQb81ymcgUeCfsptUGNrR5hYz3_AFOpDa0fnBOkoLx05jVXcAhNhk8nlkI_Ucb3Ar2NN_BziY-T0Bnb9rfCvm7mu0aW3968CYeaPMImiWMaNHJIfBzo");'></div>
        </div>
        <p class="text-gray-500 dark:text-gray-400 text-xs font-medium truncate w-16 text-center">Jessica</p>
      </div>
      <div class="flex flex-col items-center gap-2 min-w-[64px]">
        <div class="p-[2px] rounded-full bg-gradient-to-tr from-primary to-[#c084fc]">
          <div class="size-[60px] bg-center bg-no-repeat bg-cover rounded-full border-2 border-background-light dark:border-background-dark" data-alt="Portrait of David in a suit" style='background-image: url("https://lh3.googleusercontent.com/aida-public/AB6AXuBiduAro-VffUNJcPMreWUn2eAOE8gfKARHU1i1jalHY8TWGy2OZ-TAFhYI0o8n-wKhnUAIulVFozY83AR5wthvvZx_GfNas1K-KEQWvTnsl04F447eIOsvSPBFdcliQ2UoT-TMIuz4urESFmVLLMI9nwGPuU6duS9hKt1Nu7-OXjSRoUroWDwBC-cnFDgT9IBlJX0odM523GkVgA-THqpCf-UQOMH0wGhNuyB7yHufoPQZ-6OOu4uiJLykrCKGWqnUn3U98YMLZHk");'></div>
        </div>
        <p class="text-gray-900 dark:text-white text-xs font-medium truncate w-16 text-center">David</p>
      </div>
    </div>
  </div>
  <div class="px-4">
    <div class="relative overflow-hidden rounded-xl bg-surface-dark shadow-lg group">
      <div class="absolute inset-0 bg-center bg-no-repeat bg-cover" data-alt="Cinematic shot from the movie Inception with spinning top" style='background-image: url("https://lh3.googleusercontent.com/aida-public/AB6AXuCokQto59IwnhA3TYZ6ft3fa4MTFJHDTo3BCt9oc085gjn_6t2yBfy-eEKqMRnIyC-QYEvoOUFEsBbD-G7w2ODoLgQxXNfwD6Wu-S6ea8kXv478dbZyQZqhSwABQCP2vvWTsT9ZuRnOCLFhQmbwd2GXXuBd8EoU9K1-pvv7R06E3dx8FYpo6L5-0E7K1j8u1InbVFoFc8FUZKn2LZB-nUSirp8WhI-rBiCCylv1HL-0d073tI-znEO9NdCWA2E118XXHyKC5UpnDnI");'>
        <div class="absolute inset-0 bg-gradient-to-t from-[#191022] via-[#191022]/40 to-transparent"></div>
      </div>
      <div class="relative z-10 flex flex-col justify-end min-h-[400px] p-5">
        <div class="inline-flex items-center gap-2 mb-2">
          <span class="px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-wider">Top Pick</span>
          <span class="text-[#ab9db9] text-xs font-medium">98% Match</span>
        </div>
        <h2 class="text-white text-3xl font-bold leading-tight tracking-tight mb-2">Inception</h2>
        <p class="text-gray-300 text-sm font-normal line-clamp-2 mb-4">
          A thief who steals corporate secrets through the use of dream-sharing technology is given the inverse task of planting an idea into the mind of a C.E.O.
        </p>
        <div class="flex items-center gap-3">
          <button class="flex-1 h-12 bg-primary-rich hover:bg-primary/90 active:scale-95 transition-all text-white rounded-full font-bold text-base flex items-center justify-center gap-2 shadow-lg">
            <span class="material-symbols-outlined filled" style="font-size: 20px;">play_arrow</span>
            Watch Trailer
          </button>
          <button class="h-12 w-32 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white transition-colors gap-1 shadow-lg">
            <span class="material-symbols-outlined" style="font-size: 24px;">add</span>
            <span class="text-sm font-bold">Add to List</span>
          </button>
        </div>
      </div>
    </div>
  </div>
  <div>
    <div class="flex items-center justify-between px-4 pb-3">
      <h2 class="text-gray-900 dark:text-white text-xl font-bold tracking-tight">Trending Now</h2>
      <a class="text-primary text-sm font-semibold hover:text-primary/80" href="#">See All</a>
    </div>
    <div class="w-full mb-6">
      <div class="aspect-[2/3] w-full rounded-xl bg-gray-800 bg-cover bg-center overflow-hidden relative shadow-lg" data-alt="Poster for movie Dune Part Two showing desert landscape" style='background-image: url("https://lh3.googleusercontent.com/aida-public/AB6AXuBZTh7-PQIzwiQ_JwYGIFlezama-lGj_SzcQgRJRxpZyMiIvp1LASA-aFsYXfDnd7Vo_yDb9eIoHWLDhDFj_zmbLVwQ0XwDe0425k5E0_pr5pkB_Efj4oc97ZVHLvlhpxyeSjuLGii_kgA5yYRAj4tLPm_15OU1OWOE0I__pBVioEEn1r_kEd06gfD9q6x0aYOUN6CaVEpebV05TPEODFgDdefmRUnzNDvDqBreXBi39xJccblAsBR1JWifx8aG3xfL-35WXAq9ZaM");'>
        <div class="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors flex items-end p-4">
          <div class="flex flex-col gap-1 text-white">
            <h4 class="text-lg font-bold leading-tight">Dune: Part Two</h4>
            <p class="text-sm font-normal opacity-90">Sci-Fi • 2024</p>
            <div class="flex items-center gap-0.5 text-yellow-400 text-sm font-bold">
              <span class="material-symbols-outlined filled" style="font-size: 16px; font-variation-settings: 'FILL' 1;">star</span>
              4.8
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="grid grid-cols-2 xs:grid-cols-3 gap-x-4 gap-y-6 px-6 pb-2">
      <div class="flex flex-col gap-1 group cursor-pointer">
        <div class="aspect-[2/3] w-full rounded-lg bg-gray-800 bg-cover bg-center overflow-hidden relative" data-alt="Poster for Oppenheimer featuring a silhouette" style='background-image: url("https://lh3.googleusercontent.com/aida-public/AB6AXuCIVQ4rLLaRNzHsZi0SPBoG7rAFPjBlazsEGwLmV7RykFJs7MZltFErhSJXWC3aTOn21TURP8dhOgRULlhRp3li2Sqabb7aIbSYExOmwYsQuFSkDdbuKBhupr7NXNsxWpPqcHk2eb45lihBWLtY5jKhYboJm1hYTije0QW45EJmodJ_4d3h5MNnZswZZKIdCvc3Q9uhOVLKnji_L7i-TI8mx-pzJCqT4xxZEJ_kxOlSum5xzywhHDDMLnUXXmtlbr2CWSJbVbjpgzY");'>
          <div class="absolute top-2 left-2 flex items-center gap-0.5 text-yellow-500 bg-black/50 px-1 py-0.5 rounded-md text-[10px] font-bold">
            <span class="material-symbols-outlined filled" style="font-size: 12px; font-variation-settings: 'FILL' 1;">star</span>
            4.5
          </div>
        </div>
        <div>
          <h4 class="text-gray-900 dark:text-white text-sm font-bold leading-tight truncate">Oppenheimer</h4>
          <p class="text-gray-500 dark:text-gray-400 text-xs mt-0.5">Biopic</p>
        </div>
      </div>
      <div class="flex flex-col gap-1 group cursor-pointer">
        <div class="aspect-[2/3] w-full rounded-lg bg-gray-800 bg-cover bg-center overflow-hidden relative" data-alt="Abstract colorful poster for Spider-Man Across the Spiderverse" style='background-image: url("https://lh3.googleusercontent.com/aida-public/AB6AXuBdNyxrm90z3JGhw7S6BjNah9qc2desIL4Lm5unA8kaed63FbLs5O2unXfdAqhsLRZjvYpdMVZGs_ZFcQuxVinZqExo8qq8SvzQXDhANDW9I3zPG6DCXg38GOGtudm4lhmflJ8QXpzolYxJ2DAuHX1TDtQDWRjrPcnt02wHpbl3IbR3qA7N4CyFJ55lUfMtbrNZ3EMSCXqmMZ7Fiv7ITPe02x_90A_UHeyyqIEsznpR3mt4QDgfEeZwESDCLjvobLrLnhTSb_dniG0");'>
          <div class="absolute top-2 left-2 flex items-center gap-0.5 text-yellow-500 bg-black/50 px-1 py-0.5 rounded-md text-[10px] font-bold">
            <span class="material-symbols-outlined filled" style="font-size: 12px; font-variation-settings: 'FILL' 1;">star</span>
            4.9
          </div>
        </div>
        <div>
          <h4 class="text-gray-900 dark:text-white text-sm font-bold leading-tight truncate">Spider-Man</h4>
          <p class="text-gray-500 dark:text-gray-400 text-xs mt-0.5">Animation</p>
        </div>
      </div>
      <div class="flex flex-col gap-1 group cursor-pointer">
        <div class="aspect-[2/3] w-full rounded-lg bg-gray-800 bg-cover bg-center overflow-hidden relative" data-alt="Dark moody poster for The Batman" style='background-image: url("https://lh3.googleusercontent.com/aida-public/AB6AXuAVSHu66HYyCrmrnu-wY5BpesYI1Zz4uV7GxDjm9W95pzGP7ikBcIr8-1GmvmgiNjGotAyQHYPlZJQSjS9YuEt3Cgk8U760H9cDfpSGZq-fgwyK1gHlVhW_OmdPbWSIFsBqIVsnuJdU6q3bchZaGsLXpl4rb45dvTnnMh3BN7_WZWbeIo-DNGNLJ3YFCyyiGc1ASMTAICkdEaGoFlSDk5ECahNN5c4JzRRaLdMIPryFV14WCOVpWw2bnAMx3ZwiHhnRZN4M8d0PVco");'>
          <div class="absolute top-2 left-2 flex items-center gap-0.5 text-yellow-500 bg-black/50 px-1 py-0.5 rounded-md text-[10px] font-bold">
            <span class="material-symbols-outlined filled" style="font-size: 12px; font-variation-settings: 'FILL' 1;">star</span>
            4.6
          </div>
        </div>
        <div>
          <h4 class="text-gray-900 dark:text-white text-sm font-bold leading-tight truncate">The Batman</h4>
          <p class="text-gray-500 dark:text-gray-400 text-xs mt-0.5">Action</p>
        </div>
      </div>
      <div class="flex flex-col gap-1 group cursor-pointer">
        <div class="aspect-[2/3] w-full rounded-lg bg-gray-800 bg-cover bg-center overflow-hidden relative" data-alt="Poster for John Wick 4" style='background-image: url("https://lh3.googleusercontent.com/aida-public/AB6AXuBRsY99UglI7O2z6CZ-yDfxoiYa2JBfo0SUU6Th9MLWB1kqA4_sWCsZjkzwFXu1tpTXh7BDuZFpcB8nIoCaAG3SpaIg3tGuZy1Cn_Uk2ACdQPBdhhksWKQLnlLOgJo3r_Efz8CrgX5MCUTAdVhcwavlT0auyb4l3OE4E66Iea4oe_4V2F9lvcbzE0-KEuEMEh5VOfHNaJvsDk4Ltsooc3AlyBDKDlZU-u7Lg-UbcvCAeD2teymrf259UHRjL_zTRJGRjwIzYEXJ0wg");'>
          <div class="absolute top-2 left-2 flex items-center gap-0.5 text-yellow-500 bg-black/50 px-1 py-0.5 rounded-md text-[10px] font-bold">
            <span class="material-symbols-outlined filled" style="font-size: 12px; font-variation-settings: 'FILL' 1;">star</span>
            4.7
          </div>
        </div>
        <div>
          <h4 class="text-gray-900 dark:text-white text-sm font-bold leading-tight truncate">John Wick 4</h4>
          <p class="text-gray-500 dark:text-gray-400 text-xs mt-0.5">Thriller</p>
        </div>
      </div>
      <div class="flex flex-col gap-1 group cursor-pointer">
        <div class="aspect-[2/3] w-full rounded-lg bg-gray-800 bg-cover bg-center overflow-hidden relative" data-alt="Poster for Barbie" style='background-image: url("https://lh3.googleusercontent.com/aida-public/AB6AXuAtDuiFH9LxhlUte8o-k4IMRpRy96wQF2bJKNGaaVt9rBaVZA-zfMO45hD7HDcjBZ8xPbBGG4mPgFhyZ5AcBRG0rp9tz2izgGTh3X2Bnc3cBXhVycyi8MZNPBOJcBlSW36EGpnH1NMZf3U42j1Icdr3_H2Q1qk3Xf29MDK3GqLNqfB9LdO_wYy3_m9q8sCAWcK2eK4J59N0WGNFa_rQ2H-Zf2L7EYS7vIg4GPGn9m08Ghe-V_wq7W8Vd0pzZPJmN2ABKT5rc9Yg");'>
          <div class="absolute top-2 left-2 flex items-center gap-0.5 text-yellow-500 bg-black/50 px-1 py-0.5 rounded-md text-[10px] font-bold">
            <span class="material-symbols-outlined filled" style="font-size: 12px; font-variation-settings: 'FILL' 1;">star</span>
            4.3
          </div>
        </div>
        <div>
          <h4 class="text-gray-900 dark:text-white text-sm font-bold leading-tight truncate">Barbie</h4>
          <p class="text-gray-500 dark:text-gray-400 text-xs mt-0.5">Comedy</p>
        </div>
      </div>
      <div class="flex flex-col gap-1 group cursor-pointer">
        <div class="aspect-[2/3] w-full rounded-lg bg-gray-800 bg-cover bg-center overflow-hidden relative" data-alt="Poster for The Bear" style='background-image: url("https://lh3.googleusercontent.com/aida-public/AB6AXuBj5x9LAQf5x6s9S1_VEP8S2Y2_-VCmw3q3_V1c_L3cHcz0F_mBaZ6A4G3FCfSWV2S2c0-y8SsD6X6UY1yNxCiz5yUHXQ4xNA8dxgNyNeVb_iqIcoPq0X-QWrAK4m8x7r4gWfyNxhkPCUgoP0bJZCbGz_Vxrn-uPfhbTnA8eVwFD7f5lM5FG3QRc3h74qcoUXoUtU03O5nngXwWwXIgVwO8mKLBJ_3kfmI3a1uD2n5CAYs3qLiVb7ZBxVwKXrjH1TLCt4nNA");'>
          <div class="absolute top-2 left-2 flex items-center gap-0.5 text-yellow-500 bg-black/50 px-1 py-0.5 rounded-md text-[10px] font-bold">
            <span class="material-symbols-outlined filled" style="font-size: 12px; font-variation-settings: 'FILL' 1;">star</span>
            4.8
          </div>
        </div>
        <div>
          <h4 class="text-gray-900 dark:text-white text-sm font-bold leading-tight truncate">The Bear</h4>
          <p class="text-gray-500 dark:text-gray-400 text-xs mt-0.5">Series</p>
        </div>
      </div>
    </div>
  </div>
</div>
`;

const HomePage: React.FC = () => {
  useDocumentTitle("Home");

  return (
    <div
      className="bg-background-light dark:bg-background-dark font-display antialiased selection:bg-primary/30 selection:text-white pb-24"
      dangerouslySetInnerHTML={{ __html: HOME_MARKUP }}
    />
  );
};

export default HomePage;
