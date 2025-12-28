import React from "react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

const NEW_MESSAGE_MARKUP = `
<div class="bg-background-dark font-display text-text-light antialiased selection:bg-primary selection:text-white">
  <div class="relative flex h-full min-h-screen w-full max-w-md mx-auto flex-col overflow-x-hidden border-x border-slate-700 shadow-2xl shadow-black/50">
    <div class="sticky top-0 z-50 flex items-center bg-background-dark/90 backdrop-blur-md p-4 pb-2 justify-between border-b border-slate-700">
      <button class="text-text-light flex size-10 shrink-0 items-center justify-center hover:bg-surface-dark rounded-full transition-colors glow-effect">
        <span class="material-symbols-outlined" style="font-size: 24px;">close</span>
      </button>
      <h2 class="text-text-light text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center">New Message</h2>
      <button class="flex px-4 py-2 items-center justify-center rounded-full bg-primary/20 hover:bg-primary/30 transition-colors glow-effect">
        <p class="text-primary font-bold text-sm leading-normal tracking-[0.015em] shrink-0">Chat</p>
      </button>
    </div>
    <div class="px-4 py-3 bg-background-dark">
      <label class="flex flex-col h-12 w-full">
        <div class="flex w-full flex-1 items-stretch rounded-xl h-full shadow-md shadow-black/20">
          <div class="text-text-dark flex border-none bg-surface-dark items-center justify-center pl-4 rounded-l-xl border-r-0 transition-colors">
            <span class="material-symbols-outlined" style="font-size: 24px;">search</span>
          </div>
          <input class="form-input form-input-glow flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-xl rounded-l-none text-text-light focus:outline-0 focus:ring-0 border-none bg-surface-dark focus:border-none h-full placeholder:text-text-dark px-4 pl-2 text-base font-normal leading-normal transition-colors" placeholder="Search friends or username" value="" />
        </div>
      </label>
    </div>
    <div class="group/item flex items-center gap-4 px-4 py-3 min-h-16 justify-between cursor-pointer hover:bg-surface-dark transition-colors glow-effect">
      <div class="flex items-center gap-4">
        <div class="text-primary flex items-center justify-center rounded-full bg-primary/20 shrink-0 size-12 group-hover/item:bg-primary group-hover/item:text-white transition-all duration-300 shadow-md shadow-black/20">
          <span class="material-symbols-outlined" style="font-size: 24px;">group_add</span>
        </div>
        <div>
          <p class="text-text-light text-base font-medium leading-normal flex-1 truncate">Create a new group</p>
          <p class="text-text-dark text-sm font-normal">Start a watch party</p>
        </div>
      </div>
      <div class="shrink-0 text-text-dark">
        <span class="material-symbols-outlined" style="font-size: 24px;">chevron_right</span>
      </div>
    </div>
  </div>
</div>
`;

const NewMessagePage: React.FC = () => {
  useDocumentTitle("New Message");

  return <div dangerouslySetInnerHTML={{ __html: NEW_MESSAGE_MARKUP }} />;
};

export default NewMessagePage;
