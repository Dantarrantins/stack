/* Test double for the Firebase compat SDK: in-memory auth + Firestore-like store (persisted in localStorage to survive reloads). */
(function(){
  const K="mockfb";const load=()=>{try{return JSON.parse(localStorage.getItem(K))||{docs:{},user:null}}catch(e){return{docs:{},user:null}}};
  let S=load();const save=()=>localStorage.setItem(K,JSON.stringify(S));
  const L=new Set();const notify=()=>L.forEach(f=>f());
  const strip=d=>JSON.parse(JSON.stringify(d,(k,v)=>v&&v.__ts?Date.now():v));
  const snap=(path,d)=>({id:path.split("/").pop(),exists:!!d,data:()=>d?JSON.parse(JSON.stringify(d)):undefined,metadata:{fromCache:false},ref:docRef(path)});
  function docRef(path){return{id:path.split("/").pop(),path,
    get:async()=>snap(path,S.docs[path]),
    set:async(d,o)=>{S.docs[path]=o&&o.merge?{...(S.docs[path]||{}),...strip(d)}:strip(d);save();notify()},
    update:async d=>{if(!S.docs[path])throw{code:"not-found"};Object.assign(S.docs[path],strip(d));save();notify()},
    delete:async()=>{delete S.docs[path];save();notify()},
    onSnapshot:(n)=>{const f=()=>n(snap(path,S.docs[path]));L.add(f);setTimeout(f);return()=>L.delete(f)}}}
  function collRef(path,q={}){const run=()=>{let ds=Object.keys(S.docs).filter(p=>p.startsWith(path+"/")&&!p.slice(path.length+1).includes("/")).map(p=>snap(p,S.docs[p]));
      if(q.o)ds.sort((a,b)=>(a.data()[q.o]>b.data()[q.o]?1:-1)*(q.d==="desc"?-1:1));if(q.l)ds=ds.slice(0,q.l);return{docs:ds,size:ds.length,empty:!ds.length,docChanges:()=>[]}};
    return{path,doc:id=>docRef(path+"/"+id),orderBy:(o,d)=>collRef(path,{...q,o,d}),limit:l=>collRef(path,{...q,l}),get:async()=>run(),onSnapshot:n=>{const f=()=>n(run());L.add(f);setTimeout(f);return()=>L.delete(f)}}}
  const fsObj={doc:docRef,collection:collRef,enablePersistence:async()=>{},useEmulator(){},batch:()=>{const ops=[];return{set:(r,d)=>ops.push(()=>{S.docs[r.path]=strip(d)}),delete:r=>ops.push(()=>{delete S.docs[r.path]}),commit:async()=>{ops.forEach(f=>f());save();notify()}}}};
  const authL=new Set();const fire=()=>authL.forEach(f=>f(authObj.currentUser));
  const authObj={get currentUser(){return S.user?{...S.user,delete:async()=>{S.user=null;save();fire()}}:null},
    onAuthStateChanged:f=>{authL.add(f);setTimeout(()=>f(authObj.currentUser))},
    isSignInWithEmailLink:u=>u.includes("mockLink=1"),
    sendSignInLinkToEmail:async(e,s)=>{window.__sentLink=s.url+"?mockLink=1"},
    signInWithEmailLink:async(e)=>{S.user={uid:"u_"+e.replace(/\W/g,""),email:e};save();fire()},
    signInWithPopup:async()=>{S.user={uid:"u_google",email:"dan@gmail.test"};save();fire()},
    signInWithRedirect:async()=>{},getRedirectResult:async()=>null,
    signOut:async()=>{S.user=null;save();fire()},useEmulator(){}};
  window.firebase={initializeApp(){},auth:Object.assign(()=>authObj,{GoogleAuthProvider:function(){}}),firestore:Object.assign(()=>fsObj,{FieldValue:{serverTimestamp:()=>({__ts:1})}})};
})();
