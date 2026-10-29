// const2let: rewrite `const` declarations as `let` (2 bytes each) after proving, with scope resolution, that no binding a
// declaration creates is ever the target of an assignment, update or for-in/of head. For a binding that is never
// reassigned, const and let are identical at run time (same block scope, same TDZ, same per-iteration for-of binding).
import * as acorn from './deps/node_modules/acorn/dist/acorn.mjs';
import * as walk from './deps/node_modules/acorn-walk/dist/walk.mjs';
const FN = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);
const names = (p, out) => { if (!p) return out; if (p.type === 'Identifier') out.push(p); else if (p.type === 'ObjectPattern') p.properties.forEach(q => names(q.type === 'RestElement' ? q.argument : q.value, out)); else if (p.type === 'ArrayPattern') p.elements.forEach(e => names(e, out)); else if (p.type === 'RestElement') names(p.argument, out); else if (p.type === 'AssignmentPattern') names(p.left, out); return out; };
export function const2let(src, keep = () => false) {
  const ast = acorn.parse(src, { ecmaVersion: 2022, sourceType: 'script' });
  const scopes = new Map(), bind = (scope, id, decl) => { if (!scopes.has(scope)) scopes.set(scope, new Map()); scopes.get(scope).set(id.name, decl); };
  const decls = [];
  // 1. declarations -> scope node
  walk.fullAncestor(ast, (n, _s, anc) => {
    const parent = anc[anc.length - 2];
    if (n.type === 'VariableDeclaration') {
      let scope;
      if (n.kind === 'var') scope = [...anc].reverse().find(a => FN.has(a.type) || a.type === 'Program');
      else scope = /^(For|ForIn|ForOf)Statement$/.test(parent.type) ? parent : parent.type === 'SwitchCase' ? anc[anc.length - 3] : parent;
      for (const d of n.declarations) for (const id of names(d.id, [])) bind(scope, id, n);
      if (n.kind === 'const') decls.push(n);
    }
    if (FN.has(n.type)) { for (const p of n.params) for (const id of names(p, [])) bind(n, id, null); if (n.id && n.type === 'FunctionExpression') bind(n, n.id, null); }
    if (n.type === 'FunctionDeclaration' && n.id) bind(parent.type === 'SwitchCase' ? anc[anc.length - 3] : parent, n.id, null);
    if (n.type === 'CatchClause' && n.param) for (const id of names(n.param, [])) bind(n, id, null);
  });
  // 2. assignment targets -> the declaration they resolve to
  const hit = new Set(), resolve = (id, anc) => { for (let i = anc.length - 1; i >= 0; i--) { const m = scopes.get(anc[i]); if (m && m.has(id.name)) return m.get(id.name); } return undefined; };
  walk.fullAncestor(ast, (n, _s, anc) => {
    let targets = [];
    if (n.type === 'AssignmentExpression') targets = names(n.left, []);
    else if (n.type === 'UpdateExpression') targets = names(n.argument, []);
    else if ((n.type === 'ForOfStatement' || n.type === 'ForInStatement') && n.left.type !== 'VariableDeclaration') targets = names(n.left, []);
    for (const id of targets) { const d = resolve(id, anc); if (d) hit.add(d); }
  });
  const safe = decls.filter(d => !hit.has(d) && !keep(src.slice(d.start, d.end + 4)));
  let out = src;
  for (const d of safe.sort((a, b) => b.start - a.start)) {
    if (out.slice(d.start, d.start + 5) !== 'const') throw new Error('const2let: offset');
    out = out.slice(0, d.start) + 'let' + out.slice(d.start + 5);
  }
  return { out, count: safe.length, kept: decls.length - safe.length };
}
