"use client";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "../Admin.module.css";
import ui from "./StoreHealth.module.css";

type Product={id:string;name:string;status:string;is_universal_fitment:boolean;primary_image_url:string|null;description:string|null;category_id:string|null;brand_id:string|null};
type Variant={id:string;product_id:string;sku:string;title:string;price:number;stock_on_hand:number;stock_reserved:number;weight_kg:number;length_cm:number;width_cm:number;height_cm:number;variant_image_url:string|null;is_active:boolean};
type Fitment={product_id:string;variant_id:string|null};
type Image={product_id:string;image_url:string};
type Issue={key:string;category:"fitment"|"images"|"stock"|"details";productId:string;product:string;sku:string;reason:string;status:string};
const BATCH=500;
const missingAsset=(url:string|null|undefined)=>!url||(/\/mivo-shared\/gsp-(?:main|short|long)\.png/i.test(url) && false);
export default function StoreHealth(){
 const [issues,setIssues]=useState<Issue[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [tab,setTab]=useState<"all"|Issue["category"]>("all");
 const [search,setSearch]=useState("");
 const [scope,setScope]=useState("all");
 const [checkedAt,setCheckedAt]=useState("");
 async function refresh(){
  setLoading(true);setError("");
  try{
   const client=createClient();
   const {data:{user},error:authError}=await client.auth.getUser();
   if(authError)throw authError;
   if(!user){window.location.assign("/login?next=/admin/store-health");return;}
   const {data:isAdmin,error:adminError}=await client.rpc("is_admin");
   if(adminError)throw adminError;
   if(!isAdmin){window.location.assign("/admin");return;}
   async function pages<T>(table:string,cols:string):Promise<T[]>{
    const arr:T[]=[];
    for(let from=0;;from+=BATCH){
     const {data,error}=await client.from(table).select(cols).order("id").range(from,from+BATCH-1);
     if(error)throw error;
     const batch=(data||[]) as T[];
     arr.push(...batch);
     if(batch.length<BATCH)break;
    }
    return arr;
   }
   const [products,variants,fitments,images]=await Promise.all([
    pages<Product>("products","id,name,status,is_universal_fitment,primary_image_url,description,category_id,brand_id"),
    pages<Variant>("product_variants","id,product_id,sku,title,price,stock_on_hand,stock_reserved,weight_kg,length_cm,width_cm,height_cm,variant_image_url,is_active"),
    pages<Fitment>("product_vehicle_fitments","id,product_id,variant_id"),
    pages<Image>("product_images","id,product_id,image_url"),
   ]);
   const knownMissing=new Set<string>();
   // The shared GSP image paths are deliberately not marked missing unless a live request fails.
   const urls=[...new Set([...products.map(p=>p.primary_image_url),...images.map(i=>i.image_url),...variants.map(v=>v.variant_image_url)].filter((u):u is string=>Boolean(u)))];
   // Inspect remote image URLs in capped batches to avoid overloading the dashboard.
   async function checkUrl(url:string):Promise<boolean>{
    return new Promise(resolve=>{
     const img=new window.Image();
     const timeout=window.setTimeout(()=>{img.onload=null;img.onerror=null;resolve(false)},9000);
     img.onload=()=>{clearTimeout(timeout);resolve(true)};
     img.onerror=()=>{clearTimeout(timeout);resolve(false)};
     img.src=url;
    });
   }
   for(let i=0;i<urls.length;i+=12){
     const group=urls.slice(i,i+12);
     const results=await Promise.all(group.map(checkUrl));
     group.forEach((url,n)=>{if(!results[n])knownMissing.add(url)});
   }
   const productById=new Map(products.map(p=>[p.id,p]));
   const galleryByProduct=new Map<string,string[]>();
   images.forEach(i=>galleryByProduct.set(i.product_id,[...(galleryByProduct.get(i.product_id)||[]),i.image_url]));
   const whole=new Set(fitments.filter(f=>f.variant_id===null).map(f=>f.product_id));
   const specific=new Set(fitments.filter(f=>f.variant_id!==null).map(f=>f.variant_id));
   const result:Issue[]=[];
   function push(category:Issue["category"],p:Product,sku:string,reason:string,key:string){
    result.push({category,productId:p.id,product:p.name,sku,reason,key:category+":"+key,status:p.status});
   }
   for(const p of products){
    if(missingAsset(p.primary_image_url)||knownMissing.has(p.primary_image_url||""))
      push("images",p,"—","Main product image missing or cannot be loaded",p.id+":main");
    const badGallery=(galleryByProduct.get(p.id)||[]).filter(u=>knownMissing.has(u));
    if(badGallery.length)push("images",p,"—",badGallery.length+" gallery image(s) cannot be loaded",p.id+":gallery");
    if(!p.name?.trim()||!p.category_id||!p.brand_id||!p.description?.trim())
      push("details",p,"—",["Missing "+(!p.name?.trim()?"title, ":"")+(!p.category_id?"category, ":"")+(!p.brand_id?"brand, ":"")+(!p.description?.trim()?"description":"")].join(""),p.id+":product");
   }
   for(const v of variants){
    const p=productById.get(v.product_id);if(!p)continue;
    if(!p.is_universal_fitment&&!whole.has(p.id)&&!specific.has(v.id))
      push("fitment",p,v.sku||"—","No compatible vehicle assigned",v.id);
    if(v.is_active&&Number(v.stock_on_hand)-Number(v.stock_reserved)<=0)
      push("stock",p,v.sku||"—","No available stock",v.id);
    if(v.variant_image_url&&knownMissing.has(v.variant_image_url))
      push("images",p,v.sku||"—","Variation image cannot be loaded",v.id+":variant");
    if(!v.sku?.trim()||!(Number(v.price)>0)||!(Number(v.weight_kg)>0)||!(Number(v.length_cm)>0)||!(Number(v.width_cm)>0)||!(Number(v.height_cm)>0))
      push("details",p,v.sku||"—","SKU, price, weight or parcel dimensions incomplete",v.id+":variant");
   }
   setIssues(result);setCheckedAt(new Date().toLocaleString("en-MY"));
  }catch(e){setError(e instanceof Error?e.message:"Store health scan failed");}
  finally{setLoading(false);}
 }
 useEffect(()=>{void refresh()},[]);
 const categories=[{key:"fitment",title:"Unmatched SKU"},{key:"images",title:"Missing Images"},{key:"stock",title:"Out of Stock"},{key:"details",title:"Incomplete Products"}] as const;
 const filtered=useMemo(()=>issues.filter(x=>(tab==="all"||x.category===tab)&&(scope==="all"||(scope==="active"?x.status==="active":x.status!=="active"))&&(!search.trim()||[x.product,x.sku,x.reason].join(" ").toLowerCase().includes(search.trim().toLowerCase()))),[issues,tab,scope,search]);
 function csv(){
  const values=[["Issue","Product","SKU","Reason","Status"],...filtered.map(x=>[x.category,x.product,x.sku,x.reason,x.status])];
  const str="\uFEFF"+values.map(row=>row.map(x=>'"'+String(x).replaceAll('"','""')+'"').join(",")).join("\r\n");
  const url=URL.createObjectURL(new Blob([str],{type:"text/csv;charset=utf-8"}));
  const a=document.createElement("a");a.href=url;a.download="mivo-store-health.csv";a.click();URL.revokeObjectURL(url);
 }
 return <main className={styles.adminShell}><div className={styles.adminWorkspace}>
  <aside className={styles.adminSidebar}><a href="/admin" className={styles.adminBrand}><span>MIVO</span><small>STORE CONTROL</small></a><nav className={styles.adminSideNav}><a href="/admin">Dashboard</a><a href="/admin/orders">Orders</a><a href="/admin/products">Products</a><a href="/admin/store-health" className={styles.active}>Store Health</a><a href="/admin/products/unmatched">Unmatched SKU</a></nav></aside>
  <section className={styles.adminContent}>
   <header className={styles.adminHeader}><div><span className={styles.adminEyebrow}>MIVO STORE CONTROL · CATALOGUE QUALITY</span><h1>Store Health</h1><p>Monitor vehicle matching, missing images, stock and product data.</p></div><a className={styles.adminAction} href="/admin/products">ALL PRODUCTS</a></header>
   <section className={styles.adminPanel}>
    <div className={ui.cards}>{categories.map(t=><button type="button" key={t.key} className={ui.card+(tab===t.key?" "+ui.selected:"")} onClick={()=>setTab(tab===t.key?"all":t.key)}><small>{t.title}</small><strong>{loading?"—":issues.filter(x=>x.category===t.key).length}</strong><span>View affected entries</span></button>)}</div>
    <div className={ui.toolbar}><label className={styles.adminField}><span>SEARCH PRODUCT / SKU</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Product name or SKU"/></label><label className={styles.adminField}><span>STATUS</span><select value={scope} onChange={e=>setScope(e.target.value)}><option value="all">All products</option><option value="active">Live only</option><option value="unpublished">Unpublished only</option></select></label><button type="button" onClick={()=>void refresh()} disabled={loading}>REFRESH</button><button type="button" onClick={csv} disabled={loading||!filtered.length}>EXPORT CSV</button></div>
    {checkedAt&&<p className={ui.timestamp}>Last checked: {checkedAt} · {filtered.length} entries shown</p>}
    {error&&<p role="alert">{error}</p>}
    {loading?<p>Checking SKU, products, image URLs and compatibility...</p>:<div className={ui.tableWrap}><table className={ui.table}><thead><tr><th>ISSUE</th><th>PRODUCT</th><th>SKU</th><th>DETAIL</th><th>ACTION</th></tr></thead><tbody>{filtered.map(x=><tr key={x.key}><td>{categories.find(t=>t.key===x.category)?.title}</td><td>{x.product}</td><td>{x.sku}</td><td>{x.reason}</td><td><a href={"/admin/products/"+x.productId+"/edit"+(x.category==="fitment"?"#fitment":"")}>FIX PRODUCT</a></td></tr>)}</tbody></table>{filtered.length===0&&<p className={ui.timestamp}>No matching issues found.</p>}</div>}
   </section>
  </section>
 </div></main>;
}
