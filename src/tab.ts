import { CodeMirrorEditor } from './editor.js';
import { addNewTab } from './main.js';
import { attachResizeBar, attachVerticalMemdiaResizer, initVerticalSplit } from './resize.js';
//
//  <div class="tab">
//     <div class="tab-content">
//         <div class="tab-header">
//             <select name="" id="" class="language-dropdown">
//                 <option value="Praxis">Praxis</option>
//                 <option value="Python">Python</option>
//                 ...
//             </select>
//             <button class="new-editor">+</button>
//         </div>
//         <div class="editor">code goes here.</div>
//         <div class="memdia">
//             <div class="label">Diagram/Memory</div>
//             <div class="diagram"></div>
//         </div>
//     </div>
//     <div class="resize-bar"></div>

export class Tab {

    public static next_id: number = 1;

    public tab: HTMLDivElement;
    public languageDropdown: HTMLSelectElement;
    public tabButton: HTMLButtonElement;
    public editorDiv: HTMLDivElement;
    public editor: CodeMirrorEditor;
    public resizeBar: HTMLDivElement;

    constructor() {

        // grab the main element from the html (TODO : have this imported??)
        const main = document.querySelector("main") as HTMLElement;
        const editorContainer = document.getElementById("editor-container") as HTMLElement | null;
        const host = editorContainer ?? main;

        // outer div that holds the entire tab
        this.tab = document.createElement("div");
        this.tab.className = "tab";
        host.appendChild(this.tab);

        // div to hold the tab nav & editor
        const tabContent = document.createElement("div");
        tabContent.className = "tab-content";

        // tab header for the dropdown and button
        const tabHeader = document.createElement("div");
        tabHeader.className = "tab-header";

        // language dropdown
        this.languageDropdown = document.createElement("select");
        this.languageDropdown.className = "language-dropdown";
        ["CSP", "English", "Java", "Praxis", "Python"].forEach(option => {
            const o = document.createElement("option");
            o.value = option;
            o.textContent = option;
            this.languageDropdown.appendChild(o);
        });

        this.languageDropdown.addEventListener('change', () => {
          this.editor.switchLanguage(this.languageDropdown.value);
        });

        // TODO make selectedIndex the "next" language not in use
        this.languageDropdown.selectedIndex = 3;  // Show Praxis by default

        this.tabButton = document.createElement("button");
        this.tabButton.className = "new-editor";
        this.tabButton.textContent = "+";
        this.tabButton.addEventListener('click', addNewTab);

        tabHeader.appendChild(this.languageDropdown);
        tabHeader.appendChild(this.tabButton);
        tabContent.appendChild(tabHeader);

         // div to hold the code editor
        this.editorDiv = document.createElement("div");
        this.editorDiv.className = "editor panel";
        this.editorDiv.id = `editor-${Tab.next_id++}`;

        tabContent.appendChild(this.editorDiv);

        // TODO How to update multiple memdia divs?
        const memdia = document.createElement("div");
        memdia.className = "memdia";
        if (!document.getElementById("memdia-panel")) {
            memdia.id = "memdia-panel";
        }

        const memdiaLabel = document.createElement("div");
        memdiaLabel.className = "label";
        memdiaLabel.textContent = "Diagram/Memory";
        // Place label between editor and memdia to act as vertical resizer handle
        tabContent.appendChild(memdiaLabel);

        const diagram = document.createElement("div");
        diagram.className = "diagram";
        memdia.appendChild(diagram);

        tabContent.appendChild(memdia);

        // add tab content into the tab
        this.tab.appendChild(tabContent);

        // CodeMirror editor
        this.editor = new CodeMirrorEditor(this.editorDiv.id);

        // resize bar
        this.resizeBar = document.createElement("div");
        this.resizeBar.className = "resize-bar";
        attachResizeBar(this.resizeBar);

        this.tab.appendChild(this.resizeBar);

        // initialize vertical split and attach resizer
        initVerticalSplit(tabContent, 0.6);
        attachVerticalMemdiaResizer(memdiaLabel as HTMLDivElement, this.editorDiv, memdia, tabContent);

        // main.appendChild(this.tab);
    }
}
