import{c as a,g as c,n as y,o as f,s as u}from"./index-D8UbFo8l.js";/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const h=a("UserMinus",[["path",{d:"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",key:"1yyitq"}],["circle",{cx:"9",cy:"7",r:"4",key:"nufk8"}],["line",{x1:"22",x2:"16",y1:"11",y2:"11",key:"1shjgl"}]]);/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const p=a("UserPlus",[["path",{d:"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",key:"1yyitq"}],["circle",{cx:"9",cy:"7",r:"4",key:"nufk8"}],["line",{x1:"19",x2:"19",y1:"8",y2:"14",key:"1bvyxn"}],["line",{x1:"22",x2:"16",y1:"11",y2:"11",key:"1shjgl"}]]),w=e=>typeof e=="object"&&e!==null&&"code"in e,k=()=>{const{user:e}=c(),n=y();return f({mutationFn:async({targetUserId:r,currentlyFollowing:l})=>{if(!e)throw new Error("You need to be signed in to follow people.");if(e.id===r)throw new Error("You can’t follow yourself.");if(l){const{error:s}=await u.from("follows").delete().eq("follower_id",e.id).eq("followed_id",r);if(s)throw s;return{isFollowing:!1}}const{error:o}=await u.from("follows").insert({follower_id:e.id,followed_id:r});if(o&&(!w(o)||o.code!=="23505"))throw o;return{isFollowing:!0}},onSuccess:(r,l)=>{const{targetUserId:o}=l,{isFollowing:s}=r;n.setQueriesData({queryKey:["search","people"]},i=>i&&i.map(t=>t.id===o?{...t,isFollowing:s}:t)),n.invalidateQueries({queryKey:["profile"]})}})};export{h as U,p as a,k as u};
