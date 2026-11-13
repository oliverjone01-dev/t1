import {installWorkspaceShell} from './workspace-shell.mjs?rev=20261113-fix25-14';
// Panel preferences and controls initialize without waiting for Google or the board.
installWorkspaceShell({toast:message=>{const node=document.querySelector('#toast');if(node){node.textContent=message;node.hidden=false;setTimeout(()=>{node.hidden=true},6000)}}});
