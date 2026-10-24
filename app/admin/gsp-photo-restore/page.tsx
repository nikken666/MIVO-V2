"use client";
import {useState} from "react";
import {createClient} from "@/lib/supabase/client";
export default function GspPhotoRestore(){
 const [files,setFiles]=useState<(File|null)[]>([null,null,null]);
 const [message,setMessage]=useState("");
 const paths=["gsp-main.png","gsp-short.png","gsp-long.png"];
 async function restore(){
  const client=createClient();
  const {data:admin,error:authError}=await client.rpc("is_admin");
  if(authError||!admin){setMessage("Admin access required");return;}
  for(let i=0;i<3;i++){
   if(!files[i]){setMessage("Please select three images");return;}
   const {error}=await client.storage.from("product-images").upload("mivo-shared/"+paths[i],files[i]!,{upsert:true,contentType:"image/png"});
   if(error){setMessage(paths[i]+": "+error.message);return;}
  }
  setMessage("All three GSP images restored.");
 }
 return <main style={{padding:32,maxWidth:650,margin:"auto"}}><h1>Restore GSP Product Images</h1><p>Upload 1SET, SHORT and LONG images to their existing product image paths.</p>{["MAIN / 1SET","SHORT","LONG"].map((name,i)=><label key={name} style={{display:"block",marginBottom:22}}>{name}<input type="file" accept="image/png" onChange={e=>setFiles(a=>a.map((f,j)=>i===j?e.target.files?.[0]||null:f))}/></label>)}<button type="button" onClick={()=>void restore()}>RESTORE GSP IMAGES</button><p>{message}</p></main>;
}