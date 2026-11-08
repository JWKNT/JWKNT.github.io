// The homepage introduction. The owner wrote it, so it keeps their exact words,
// paragraphs and bold names, and it carries the human mark from the site theme
// (`.ui-human`). The seal is style library icon i0063, the Ruffle seal, and the h1
// keeps the site name.
export const introParagraphs = [
  'I have been on the internet a long time, and depending on where you have encountered me, I have gone by <strong>Jay</strong>, <strong>JW</strong>, <strong>jehlp</strong>, or <strong>KNT</strong>. I am interested in mathematics, data science, puzzles, science fiction, and otaku culture.',
  'This website serves as a work-in-progress centralization of my past and future brainchildren, and everything directly on this site (i.e., any page starting with jehlp.net/) is written and programmed fully by AI under my supervision, unless explicitly marked with this symbol shown to the right',
];

const seal = '<svg class="intro-seal" aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="112" height="112" fill="none" stroke="currentColor" stroke-width="1.15"><path d="M12 3.2C14 2.1 16 4 16 5.5C19.5 4.5 21.5 7.7 19.5 10C23 12 20.5 15.5 18.5 15.5C19 19 16 21 13.8 19.5C12 23 8.5 20.5 8.5 18.5C5 19 3 16 4.5 13.8C1 12 3.5 8.5 5.5 8.5C5 5 8 3 10.2 4.5Z"/><path d="M7.5 12C9 8.5 15 8.5 16.5 12C15 15.5 9 15.5 7.5 12Z" stroke-width=".95"/><rect class="seal-point" x="11.15" y="11.15" width="1.7" height="1.7" stroke="none"/></svg>';

// The arrow uses the devices of the studies below: an accent point, one stroke and a faint echo.
const arrow = '<svg class="intro-arrow" aria-hidden="true" focusable="false" viewBox="0 0 32 12" width="32" height="12" fill="none" stroke="currentColor" stroke-width="1.25"><path class="arrow-echo" d="M21 1.2 25.8 6 21 10.8" stroke-width="1.1"/><path d="M5.5 6H30M25.2 1.2 30 6 25.2 10.8"/><rect class="arrow-point" x=".2" y="4.65" width="2.7" height="2.7" stroke="none"/></svg>';

export const intro = `<div class="site-intro">
        <h1 class="site-seal"><span class="sr-only">jehlp.net</span>${seal}</h1>
        <div class="intro-text ui-human">
          <p>${introParagraphs[0]}</p>
          <p>${introParagraphs[1].replace(/ (\S+ \S+)$/, ' <span class="intro-end">$1&nbsp;')}${arrow}</span></p>
          <span class="ui-human-mark" role="img" aria-label="Written by a human" title="Written by a human"></span>
        </div>
      </div>`;
