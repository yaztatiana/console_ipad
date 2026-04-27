 (function (global) {
   "use strict";
 
   var DS = global.DashboardStore;
 
   function desiredThemeId() {
     try {
       var data = DS && DS.load ? DS.load() : null;
       var tid = data && data.settings ? String(data.settings.themeId || "") : "";
      if (!tid) return "pastel-prism";
       return tid;
     } catch (e) {
      return "pastel-prism";
     }
   }
 
   function applyThemeToBody(themeId) {
     var b = global.document && global.document.body;
     if (!b || !b.classList) return;
     var keep = [];
     b.className
       .split(/\s+/)
       .filter(Boolean)
       .forEach(function (c) {
         if (c.indexOf("theme-") === 0) return;
         keep.push(c);
       });
     keep.push("theme");
     keep.push("theme-" + themeId);
     b.className = keep.join(" ");
   }
 
   function applyFromStore() {
     applyThemeToBody(desiredThemeId());
   }
 
   global.DashboardTheme = {
     applyFromStore: applyFromStore,
     applyThemeToBody: applyThemeToBody,
   };
 
   if (global.document && global.document.readyState === "loading") {
     global.document.addEventListener("DOMContentLoaded", applyFromStore);
   } else {
     applyFromStore();
   }
 })(window);

