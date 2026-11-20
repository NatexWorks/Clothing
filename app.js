import * as THREE from 'three';

const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const escapeHtml=(value='')=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const safeImage=(value)=>/^https:\/\//i.test(String(value||''))?value:'';
const floorData=[
  {id:'ground',label:'GROUND FLOOR',title:'New arrivals',audience:'Everyone',categories:['T-shirts','Casual shirts','Jeans','Trousers','Jackets','Accessories'],progress:.31},
  {id:'first',label:'FIRST FLOOR',title:'The women’s floor',audience:'Women',categories:['T-shirts','Casual shirts','Formal shirts','Jeans','Trousers','Jackets','Blazers'],progress:.57},
  {id:'second',label:'SECOND FLOOR',title:'The men’s floor',audience:'Men',categories:['T-shirts','Casual shirts','Formal shirts','Jeans','Trousers','Jackets','Blazers'],progress:.69},
  {id:'third',label:'THIRD FLOOR',title:'The children’s floor',audience:'Children',categories:['T-shirts','Casual shirts','Jeans','Jackets'],progress:.82},
  {id:'fourth',label:'FOURTH FLOOR',title:'The grandparents’ floor',audience:'Grandparents',categories:['Casual shirts','Trousers','Jackets','Blazers'],progress:.93},
];
const chapters=$$('.chapter');
const journey=$('#journey');
const canvas=$('#store-world');
const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let products=[];
let productsById=new Map();
let activeFloor='ground';
let activeCategory='';
let activeChapter=0;
let scrollProgress=0;
let routeToken=0;
let aiHistory=[];
let busy=false;
let selectedProduct=null;
let selectedSize='';
let cart=readCart();
let currentLook=new THREE.Vector3(0,2,5);
let categoryCameraTarget=null;

const scene=new THREE.Scene();
scene.background=new THREE.Color('#c8bca8');
scene.fog=new THREE.Fog('#c8bca8',40,90);
const camera=new THREE.PerspectiveCamera(42,window.innerWidth/window.innerHeight,.1,130);
camera.position.set(0,2,12.8);
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.55));
renderer.setSize(window.innerWidth,window.innerHeight,false);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.14;
const raycaster=new THREE.Raycaster();
const pointer=new THREE.Vector2();
const clickable=[];
const mannequinGroups=[];
const shelfTargets=new Map();
const lights=[];
const doorPivots=[];
const elevatorCar=new THREE.Group();
const mat=(color,roughness=.78,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
const colors={plaster:'#ddd4c3',plasterLight:'#eee7da',walnut:'#694b37',darkWood:'#3f3025',brass:'#a48b62',stone:'#aa9a81',floor:'#bda88d',skin:'#d4c3a7',glass:'#84918c',dark:'#39342d',olive:'#797b65'};
const mats={plaster:mat(colors.plaster),light:mat(colors.plasterLight),wood:mat(colors.walnut),darkWood:mat(colors.darkWood),brass:mat(colors.brass,.34,.6),stone:mat(colors.stone),floor:mat(colors.floor),skin:mat(colors.skin),dark:mat(colors.dark),olive:mat(colors.olive)};
scene.add(new THREE.HemisphereLight('#fff5df','#62584a',2.2));
const keyLight=new THREE.DirectionalLight('#ffe5bc',3.2);keyLight.position.set(-8,19,10);scene.add(keyLight);
const fillLight=new THREE.DirectionalLight('#d5dfe0',1.1);fillLight.position.set(10,10,-12);scene.add(fillLight);
const entranceLight=new THREE.PointLight('#ffd9a5',0,15,2);entranceLight.position.set(0,4,4);scene.add(entranceLight);lights.push(entranceLight);

function box(parent,name,size,position,material,options={}){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),material);
  mesh.name=name;mesh.position.set(...position);
  if(options.rotation)mesh.rotation.set(...options.rotation);
  if(options.cast)mesh.castShadow=true;
  if(options.receive)mesh.receiveShadow=true;
  parent.add(mesh);return mesh;
}
function rod(parent,start,end,radius,material,radial=8){
  const a=new THREE.Vector3(...start),b=new THREE.Vector3(...end),direction=new THREE.Vector3().subVectors(b,a);
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,direction.length(),radial),material);
  mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());parent.add(mesh);return mesh;
}
function makeGate(){
  const facadeZ=11.5;
  box(scene,'store facade left',[11,20,.42],[-9.5,10,facadeZ],mats.plasterLight);
  box(scene,'store facade right',[11,20,.42],[9.5,10,facadeZ],mats.plasterLight);
  box(scene,'store lintel',[5.5,1.25,.52],[0,17.4,facadeZ],mats.darkWood);
  box(scene,'walnut door frame',[4.65,4.25,.32],[0,2.15,11.25],mats.wood);
  box(scene,'threshold stone',[5.3,.2,.9],[0,.08,11.6],mats.stone);
  const glass=new THREE.MeshPhysicalMaterial({color:'#b5c1ba',roughness:.25,metalness:.12,transparent:true,opacity:.32});
  for(const side of [-1,1]){
    const pivot=new THREE.Group();pivot.position.set(side*2.15,0,11.02);scene.add(pivot);doorPivots.push({pivot,side});
    box(pivot,'glass entry leaf',[2.12,3.9,.14],[side*-1.05,2.05,0],glass);
    box(pivot,'walnut stile',[.11,4,.18],[side*-2.05,2.05,.02],mats.darkWood);
    const handle=rod(pivot,[side*-1.72,1.9,-.1],[side*-1.72,2.55,-.1],.035,mats.brass);
    handle.name='brass pull';
  }
  box(scene,'street step',[24,.26,7],[0,-.15,15.3],mats.stone);
  for(let floor=0;floor<4;floor++){
    const y=5+floor*3.6;
    box(scene,`upper window dark ${floor}`,[2.15,2.45,.15],[-8.4,y,11.82],mats.darkWood);
    box(scene,`upper window glass ${floor}`,[1.86,2.16,.06],[-8.4,y,11.91],glass);
    box(scene,`upper window dark right ${floor}`,[2.15,2.45,.15],[8.4,y,11.82],mats.darkWood);
    box(scene,`upper window glass right ${floor}`,[1.86,2.16,.06],[8.4,y,11.91],glass);
    box(scene,`floor front fascia ${floor}`,[30,.2,.44],[0,3.54+floor*3.6,11.82],mats.wood);
  }
  box(scene,'roof fascia',[30,.5,.65],[0,20.2,11.85],mats.darkWood);
  const storefrontGlass=new THREE.MeshPhysicalMaterial({color:'#d2d9d2',roughness:.22,metalness:.12,transparent:true,opacity:.22});
  for(const side of [-1,1]){
    box(scene,`ground storefront glazing ${side}`,[1.45,3.9,.08],[side*3.18,1.98,11.72],storefrontGlass);
    rod(scene,[side*3.9,.1,11.76],[side*3.9,3.9,11.76],.035,mats.brass,6);
  }
}
function buildArchitecture(){
  box(scene,'site ground',[110,.3,120],[0,-.38,0],mat('#938975'));
  box(scene,'store ground floor',[30,.28,23],[0,0,0],mats.floor);
  for(let level=1;level<=4;level++){
    const y=level*3.6;
    if(level===1){
      // The first-floor slab deliberately leaves the entry atrium open.
      box(scene,'first-floor west balcony',[12.25,.24,23],[-8.875,y,0],mats.floor);
      box(scene,'first-floor east balcony',[12.25,.24,23],[8.875,y,0],mats.floor);
      box(scene,'first-floor rear bridge',[5.5,.24,5.1],[0,y,-8.95],mats.floor);
      box(scene,'atrium front bridge',[5.5,.24,2.1],[0,y,10.05],mats.floor);
    }else box(scene,`level slab ${level}`,[30,.26,23],[0,y,0],mats.floor);
    box(scene,`atrium rail ${level} north`,[5.6,.78,.1],[0,y+.42,8.7],mats.brass);
    for(const x of [-2.72,2.72])box(scene,`atrium rail ${level} side`,[.1,.78,5.2],[x,y+.42,.1],mats.brass);
    box(scene,`level edge ${level}`,[18,.16,.24],[0,y-.04,6.9],mats.darkWood);
  }
  box(scene,'rear wall',[30,20,.35],[0,9,-11.7],mats.plaster);
  box(scene,'left wall',[.35,20,23],[-14.95,9,0],mats.plaster);
  box(scene,'right wall',[.35,20,23],[14.95,9,0],mats.plaster);
  box(scene,'store ceiling',[30,.3,23],[0,18.2,0],mats.plasterLight);
  for(let floor=0;floor<5;floor++){
    const base=floor*3.6;
    for(const z of [-8.5,-4.4,0,4.4,8.2]){
      box(scene,`wall inset left ${floor} ${z}`,[.06,1.75,1.75],[-14.74,base+2.05,z],mat('#a9ab9e',.3,.08));
      box(scene,`wall inset right ${floor} ${z}`,[.06,1.75,1.75],[14.74,base+2.05,z],mat('#a9ab9e',.3,.08));
    }
    const lamp=new THREE.PointLight('#ffdfb1',floor===0?1.35:.9,13,2);lamp.position.set(0,base+3.1,-1.2);scene.add(lamp);lights.push(lamp);
    box(scene,`ceiling cove ${floor}`,[10,.08,.12],[0,base+3.46,-4.8],mats.brass);
  }
  makeGate();
  buildUStairs();
  buildLift();
  buildFurniture();
}
function buildUStairs(){
  const stairMaterial=mat('#8a6849',.62);
  const railMaterial=mat('#8e795b',.4,.28);
  for(let level=0;level<4;level++){
    const base=level*3.6;
    for(let i=0;i<8;i++){
      const rise=.225,run=.45;
      box(scene,`u stair ${level+1} flight a step ${i+1}`,[1.3,.12,.52],[4.1,base+.08+i*rise,2.35-i*run],stairMaterial);
      box(scene,`u stair ${level+1} flight b step ${i+1}`,[1.3,.12,.52],[2.15,base+1.9+i*rise,-1.15+i*run],stairMaterial);
      rod(scene,[4.7,base+.18+i*rise,2.4-i*run],[4.7,base+.98+i*rise,2.4-i*run],.027,railMaterial,6);
      rod(scene,[1.58,base+2.0+i*rise,-1.2+i*run],[1.58,base+2.72+i*rise,-1.2+i*run],.027,railMaterial,6);
    }
    box(scene,`u stair ${level+1} intermediate landing`,[3.45,.16,2.25],[3.05,base+1.9,-1.25],mats.floor);
    rod(scene,[4.75,base+2.02,-2.2],[1.55,base+2.02,-2.2],.035,railMaterial,8);
    box(scene,`stair landing fascia ${level+1}`,[3.45,.2,.16],[3.05,base+1.78,-2.35],mats.darkWood);
  }
}
function buildLift(){
  const frame=mat('#79664e',.36,.38);
  const glass=new THREE.MeshPhysicalMaterial({color:'#c3c7bb',roughness:.25,transparent:true,opacity:.2,metalness:.18});
  for(const x of [-6.7,-4.8])rod(scene,[x,.2,-3.1],[x,18,-3.1],.09,frame,8);
  for(const z of [-4,-2.2])rod(scene,[-5.75,.2,z],[-5.75,18,z],.07,frame,8);
  box(scene,'lift shaft side',[.08,17.5,.1],[-4.75,9,-3.1],glass);
  box(scene,'lift shaft side far',[.08,17.5,.1],[-6.75,9,-3.1],glass);
  box(scene,'lift car floor',[1.72,.13,1.65],[-5.75,.5,-3.1],mats.darkWood);
  box(elevatorCar,'lift car back',[1.65,2.9,.12],[0,1.48,-.76],mats.plasterLight);
  box(elevatorCar,'lift car left',[.12,2.9,1.5],[-.78,1.48,0],glass);
  box(elevatorCar,'lift car right',[.12,2.9,1.5],[.78,1.48,0],glass);
  box(elevatorCar,'lift car canopy',[1.65,.1,1.5],[0,2.97,0],mats.brass);
  elevatorCar.position.set(-5.75,.5,-3.1);scene.add(elevatorCar);
  for(let level=0;level<=4;level++){
    const y=.6+level*3.6;
    box(scene,`lift call plate ${level}`,[.18,.38,.07],[-7.05,y,-2.1],mats.darkWood);
    const bulb=new THREE.Mesh(new THREE.SphereGeometry(.055,8,8),mat(level===0?'#dbcb99':'#8b887c',.28,.2));bulb.position.set(-7.05,y,-2.055);scene.add(bulb);
  }
}
function clothingShape(width,height,outerwear=false){
  const w=width/2,h=height/2,shape=new THREE.Shape();
  shape.moveTo(-w*.32,h);shape.lineTo(w*.32,h);shape.lineTo(w*.54,h*.67);shape.lineTo(w,h*.43);shape.lineTo(w*.82,h*.08);shape.lineTo(w*.59,h*.18);shape.lineTo(w*.58,-h);shape.lineTo(-w*.58,-h);shape.lineTo(-w*.59,h*.18);shape.lineTo(-w*.82,h*.08);shape.lineTo(-w,h*.43);shape.lineTo(-w*.54,h*.67);shape.closePath();
  if(outerwear){shape.moveTo(-w*.3,-h);shape.lineTo(w*.3,-h);shape.lineTo(w*.25,-h*.38);shape.lineTo(-w*.25,-h*.38);shape.closePath()}
  return shape;
}
function foldedShirtShape(width,height){
  const w=width/2,h=height/2,shape=new THREE.Shape();
  shape.moveTo(-w*.32,h);shape.lineTo(w*.32,h);shape.lineTo(w*.53,h*.66);shape.lineTo(w,h*.42);shape.lineTo(w*.82,h*.08);shape.lineTo(w*.59,h*.18);shape.lineTo(w*.58,-h);shape.lineTo(-w*.58,-h);shape.lineTo(-w*.59,h*.18);shape.lineTo(-w*.82,h*.08);shape.lineTo(-w,h*.42);shape.lineTo(-w*.53,h*.66);shape.closePath();
  return shape;
}
function clothingMesh(width,height,material,outerwear=false,depth=.1){
  const geometry=new THREE.ExtrudeGeometry(clothingShape(width,height,outerwear),{depth,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.018,bevelThickness:.018});
  geometry.center();const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=true;return mesh;
}
function trouserMesh(width,height,material,depth=.11){
  const w=width/2,h=height/2,shape=new THREE.Shape();
  shape.moveTo(-w*.48,h);shape.lineTo(w*.48,h);shape.lineTo(w*.43,-h);shape.lineTo(w*.08,-h);shape.lineTo(0,-h*.12);shape.lineTo(-w*.08,-h);shape.lineTo(-w*.43,-h);shape.closePath();
  const geometry=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.014,bevelThickness:.014});geometry.center();const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=true;return mesh;
}
function mannequin(parent,product,x,y,z,scale=1){
  const group=new THREE.Group();group.position.set(x,y,z);group.scale.setScalar(scale);parent.add(group);
  const fabric=mat(product?.mannequinColor||'#b7a68d',.8,0);
  const skin=mats.skin;
  const stand=mat('#83745e',.37,.54);
  const pedestal=new THREE.Mesh(new THREE.CylinderGeometry(.38,.43,.1,18),stand);pedestal.position.y=.12;group.add(pedestal);
  rod(group,[0,.18,0],[0,.46,0],.035,stand);
  const legs=mat('#c6bba9');
  for(const side of [-1,1]){
    const leg=new THREE.Mesh(new THREE.CylinderGeometry(.095,.12,.8,10),legs);leg.position.set(side*.16,.89,0);group.add(leg);
    const shoe=new THREE.Mesh(new THREE.BoxGeometry(.23,.11,.38),mats.dark);shoe.position.set(side*.16,.47,.08);group.add(shoe);
    const arm=new THREE.Mesh(new THREE.CylinderGeometry(.09,.13,.94,10),skin);arm.position.set(side*.47,1.7,0);arm.rotation.z=side*-.11;group.add(arm);
    const hand=new THREE.Mesh(new THREE.SphereGeometry(.09,10,8),skin);hand.position.set(side*.51,1.22,.015);group.add(hand);
  }
  const torso=clothingMesh(.92,1.12,fabric,/Jacket|Blazer/i.test(product?.category||''),.16);torso.position.set(0,1.68,.035);group.add(torso);
  const collar=new THREE.Mesh(new THREE.TorusGeometry(.13,.035,6,12,Math.PI),mat('#eee4d2'));collar.rotation.x=Math.PI/2;collar.position.set(0,2.19,.12);group.add(collar);
  const buttonMat=mat('#e8dfcf',.35,.2);
  for(let i=0;i<4;i++){const button=new THREE.Mesh(new THREE.SphereGeometry(.024,7,6),buttonMat);button.position.set(0,2.02-i*.15,.145);group.add(button)}
  const pocket=box(group,'garment chest pocket',[.18,.17,.025],[-.22,1.81,.13],fabric);pocket.material=mat(product?.mannequinColor||'#b7a68d',.9);
  const neck=new THREE.Mesh(new THREE.CylinderGeometry(.09,.1,.22,10),skin);neck.position.y=2.28;group.add(neck);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.22,16,14),mat('#c9b99f'));head.scale.set(.88,1.17,.9);head.position.y=2.57;group.add(head);
  if(/Trousers|Jeans/i.test(product?.category||'')){
    const trousers=trouserMesh(.62,.88,fabric,.17);trousers.position.set(0,.96,.07);group.add(trousers);
    for(let i=0;i<8;i++)box(group,`trouser stitch ${i}`,[.012,.012,.018],[i<4?-.22:.22,.54+(i%4)*.11,.17],mats.light);
  }
  const pick=new THREE.Mesh(new THREE.SphereGeometry(.72,12,8),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}));pick.position.y=1.55;pick.userData.productId=product?.id;group.add(pick);if(product)clickable.push(pick);
  mannequinGroups.push(group);return group;
}
function garmentStyle(product){
  if(/Jeans|Trousers/i.test(product.category))return 'trouser';
  if(/Jacket|Blazer/i.test(product.category))return 'coat';
  if(product.id.includes('scarf')||product.name.toLowerCase().includes('wrap'))return 'scarf';
  if(product.id.includes('bag')||product.name.toLowerCase().includes('tote'))return 'bag';
  return 'shirt';
}
function garment(parent,color,x,y,z,shape='shirt'){
  const fabric=mat(color,.88,0);const hanger=mat('#a28c6c',.34,.4);
  const group=new THREE.Group();group.position.set(x,y,z);parent.add(group);
  const width=shape==='coat'?.63:.54,height=shape==='trouser'?.72:.73;
  if(shape==='trouser'){
    const pants=trouserMesh(width,height,fabric,.12);pants.position.y=-.02;group.add(pants);
    box(group,'hanging trouser waistband',[width,.085,.15],[0,.3,.015],fabric);
    rod(group,[0,.23,.09],[0,-.32,.09],.008,hanger,5);
  }else if(shape==='scarf'){
    box(group,'folded scarf shoulder',[.45,.15,.1],[0,.12,0],fabric);
    box(group,'scarf tail left',[.14,.55,.08],[-.12,-.22,0],fabric,{rotation:[0,0,-.08]});
    box(group,'scarf tail right',[.14,.55,.08],[.12,-.22,.015],fabric,{rotation:[0,0,.08]});
  }else if(shape==='bag'){
    box(group,'canvas tote body',[.48,.45,.16],[0,-.04,0],fabric);
    rod(group,[-.16,.18,0],[-.13,.4,0],.025,hanger,7);rod(group,[.16,.18,0],[.13,.4,0],.025,hanger,7);
  }else{
    group.add(clothingMesh(width,height,fabric,shape==='coat',.12));
    const placket=mat('#d9cbb3',.5,.08);
    for(let i=0;i<4;i++){const button=new THREE.Mesh(new THREE.SphereGeometry(.015,6,5),placket);button.position.set(0,.19-i*.13,.075);group.add(button)}
    box(group,'garment pocket',[.12,.12,.018],[width*.25,-.02,.07],fabric);
  }
  rod(group,[-.34,.48,0],[0,.62,0],.013,hanger,5);rod(group,[0,.62,0],[.34,.48,0],.013,hanger,5);rod(group,[0,.62,0],[0,.75,0],.013,hanger,5);
  return group;
}
function productSign(product,x,y,z){
  const canvasEl=document.createElement('canvas');canvasEl.width=512;canvasEl.height=170;const ctx=canvasEl.getContext('2d');
  ctx.fillStyle='#eee8dc';ctx.fillRect(0,0,512,170);ctx.fillStyle='#7d674c';ctx.fillRect(0,0,8,170);ctx.fillStyle='#454035';ctx.font='500 29px sans-serif';ctx.fillText(product.name.toUpperCase().slice(0,24),29,55);ctx.fillStyle='#827b6e';ctx.font='22px sans-serif';ctx.fillText(`${product.category.toUpperCase()}  ·  ${product.color.toUpperCase()}`,29,93);ctx.fillStyle='#473a2d';ctx.font='500 26px sans-serif';ctx.fillText(`₹${Number(product.price).toLocaleString('en-IN')}`,29,139);
  const texture=new THREE.CanvasTexture(canvasEl);texture.colorSpace=THREE.SRGBColorSpace;
  const material=new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide});const mesh=new THREE.Mesh(new THREE.PlaneGeometry(1.22,.4),material);mesh.position.set(x,y,z);mesh.userData.productId=product.id;scene.add(mesh);clickable.push(mesh);return mesh;
}
function buildRack(floorProducts,floorIndex){
  const y=floorIndex*3.6+.1,x=-5.1,z=-1.9;const rack=new THREE.Group();rack.position.set(x,y,z);scene.add(rack);
  const metal=mat('#8f7b5e',.37,.52);
  rod(rack,[-.25,.2,0],[-.25,2.1,0],.045,metal);rod(rack,[2.55,.2,0],[2.55,2.1,0],.045,metal);rod(rack,[-.25,2.1,0],[2.55,2.1,0],.045,metal);
  rod(rack,[-.45,.18,.12],[2.75,.18,.12],.036,metal);
  floorProducts.slice(0,5).forEach((product,index)=>garment(rack,product.mannequinColor,.12+index*.52,1.65,0,garmentStyle(product)));
}
function buildWallShelves(floorProducts,floorIndex){
  const base=floorIndex*3.6;
  const groups=new Map();
  floorProducts.forEach(product=>{if(!groups.has(product.category))groups.set(product.category,[]);groups.get(product.category).push(product)});
  const categories=[...groups.entries()];
  const width=3.15,gap=.18,startX=-categories.length*(width+gap)/2+(width+gap)/2;
  categories.forEach(([category,items],bay)=>{
    const x=startX+bay*(width+gap),backZ=-9.95;
    shelfTargets.set(`${floorIndex}:${category}`,{position:new THREE.Vector3(x,base+1.58,backZ+4.6),target:new THREE.Vector3(x,base+1.3,backZ+.55)});
    box(scene,`walnut shelf backing ${floorIndex} ${category}`,[width,3.02,.18],[x,base+1.72,backZ],mats.darkWood);
    box(scene,`shelf side left ${floorIndex} ${category}`,[.1,3.18,1.25],[x-width/2+.05,base+1.72,backZ+.58],mats.wood);
    box(scene,`shelf side right ${floorIndex} ${category}`,[.1,3.18,1.25],[x+width/2-.05,base+1.72,backZ+.58],mats.wood);
    for(let level=0;level<4;level++){
      const shelfY=base+.42+level*.73;
      box(scene,`folded apparel shelf ${floorIndex} ${category} ${level}`,[width,.11,1.38],[x,shelfY,backZ+.64],mats.wood);
      const product=items[level%items.length];
      const color=mat(product.colorHex||product.mannequinColor,.88);
      const pileX=x-width*.25;
      for(let layer=0;layer<3;layer++){
        const garmentWidth=.82-layer*.035;
        box(scene,`folded ${product.category} ${layer}`,[garmentWidth,.105,.63],[pileX,shelfY+.09+layer*.115,backZ+.58],color);
        for(let stitch=0;stitch<7;stitch++)box(scene,`fold stitch ${product.id} ${level} ${stitch}`,[.07,.012,.018],[pileX-.25+stitch*.085,shelfY+.09+layer*.115,backZ+.9],mats.light);
      }
      const second=items[(level+1)%items.length];
      if(items.length>1||level===0){
        const secondColor=mat(second.colorHex||second.mannequinColor,.88);
        for(let layer=0;layer<2;layer++)box(scene,`folded colorway ${second.category} ${layer}`,[.64-layer*.04,.105,.57],[x+width*.25,shelfY+.09+layer*.12,backZ+.56],secondColor);
        const pick=new THREE.Mesh(new THREE.BoxGeometry(1.25,.43,.95),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}));
        pick.position.set(x,shelfY+.28,backZ+.56);pick.userData.productId=product.id;scene.add(pick);clickable.push(pick);
      }
    }
    const signCanvas=document.createElement('canvas');signCanvas.width=512;signCanvas.height=96;
    const ctx=signCanvas.getContext('2d');ctx.fillStyle='#e8dfcf';ctx.fillRect(0,0,512,96);ctx.fillStyle='#4a392a';ctx.font='600 35px sans-serif';ctx.fillText(category.toUpperCase(),24,60);
    const sign=new THREE.Mesh(new THREE.PlaneGeometry(2.5,.46),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(signCanvas)}));
    sign.position.set(x,base+3.38,backZ+.12);scene.add(sign);
  });
}
function buildFloorScene(floorId,index){
  const levelY=index*3.6;const floorProducts=products.filter(item=>item.floorId===floorId).sort((a,b)=>Number(a.category==='Accessories')-Number(b.category==='Accessories'));
  if(floorId==='first'){
    buildWallShelves(floorProducts,index);
    const display=[[-8,-3],[-6,-3],[-4,-3],[4,-3],[6,-3],[8,-3],[-8,3],[-6,3],[-4,3],[4,3]];
    display.forEach(([x,z],i)=>{const product=floorProducts[i%floorProducts.length];mannequin(scene,product,x,levelY,z,.76);productSign(product,x,levelY+3.05,z-.1)});
    const metal=mat('#927a5d',.38,.48);
    for(const [x,z,productsInRack] of [[-11,-1,floorProducts.slice(0,4)],[-11,4,floorProducts.slice(4)], [11,-1,floorProducts.slice(2,6)],[11,4,floorProducts.slice(0,3)]]){
      rod(scene,[x,levelY+.25,z],[x,levelY+2.25,z],.055,metal);rod(scene,[x,levelY+2.25,z],[x+(x<0?2.2:-2.2),levelY+2.25,z],.045,metal);
      productsInRack.forEach((p,j)=>garment(scene,p.mannequinColor,x+(x<0?.25:-.25)+(x<0?1:-1)*j*.43,levelY+1.65,z,garmentStyle(p)));
    }
    for(const [x,z] of [[-2,-.3],[2,-.3],[-2,4],[2,4]])box(scene,'women floor central display table',[2.2,.72,1.25],[x,levelY+.42,z],mats.wood);
    box(scene,'women assistant desk',[2.5,1.05,.85],[-4,levelY+.55,8.1],mats.darkWood);
    for(const x of [-5.5,-2.5]){box(scene,'assistant chair seat',[.7,.16,.7],[x,levelY+.48,9.35],mats.brass);box(scene,'assistant chair back',[.7,.8,.14],[x,levelY+.91,9.65],mats.brass)}
    box(scene,'women billing counter',[2.7,1.05,.85],[4,levelY+.55,8.1],mats.darkWood);
    for(const x of [-13,13]){const pot=new THREE.Mesh(new THREE.CylinderGeometry(.22,.3,.45,10),mats.stone);pot.position.set(x,levelY+.23,10);scene.add(pot);const leaf=new THREE.Mesh(new THREE.SphereGeometry(.65,10,8),mat('#71866d'));leaf.scale.y=1.45;leaf.position.set(x,levelY+.95,10);scene.add(leaf)}
    for(const [x,z] of [[8,6],[11,6]]){box(scene,'fitting room bay',[2.4,2.7,2.8],[x,levelY+1.35,z],mats.plasterLight)}
    box(scene,'women floor rug',[18,.04,13],[0,levelY+.03,-.3],mat('#b89f84'));
    return;
  }
  buildWallShelves(floorProducts,index);
  const displayProducts=floorProducts.slice(0,4);
  displayProducts.forEach((product,i)=>{
    const x=[-3.4,-.75,2.2,4.2][i],z=[-2.6,-4.3,-2.9,-5.1][i],scale=i===1?1.05:.95;
    mannequin(scene,product,x,levelY,z,scale);
    box(scene,`low product plinth ${product.id}`,[1.6,.18,1.2],[x,levelY+.17,z],mats.darkWood);
    productSign(product,x,levelY+3.18,z-.02);
  });
  if(floorProducts.length>4)buildRack(floorProducts.slice(4),index);
  for(let col=0;col<8;col++){
    const lamp=new THREE.Mesh(new THREE.CylinderGeometry(.22,.32,.08,14),mats.brass);lamp.position.set(-12+col*3.4,levelY+3.25,-6.7);scene.add(lamp);
    const glow=new THREE.PointLight('#ffe0b5',.45,7,2);glow.position.set(-12+col*3.4,levelY+2.95,-6.7);scene.add(glow);
  }
  box(scene,`floor rug ${floorId}`,[8,.035,5],[-.4,levelY+.18,-2.5],mat(index%2?'#92826d':'#a7977d'));
}
function buildFurniture(){
  for(let i=0;i<5;i++){
    const productFloor=floorData[i].id;
    box(scene,`floor zone marker ${i}`,[.04,2.1,.04],[7.2,i*3.6+1.15,-5.8],mats.brass);
    const plaque=box(scene,`floor plaque ${i}`,[.72,.4,.08],[7.1,i*3.6+2.55,-5.8],mats.darkWood);
    plaque.userData.floorId=productFloor;
  }
  for(let i=0;i<6;i++){
    const x=-7.5+i*3,z=10.8;
    box(scene,`walkway inlay ${i}`,[.04,.012,3],[x,.02,z],mats.brass);
  }
}
buildArchitecture();

const cameraFrames=[
  {p:0,position:[0,2,12.8],target:[0,2.2,1]},
  {p:.1,position:[0,2,9],target:[0,2.1,-1]},
  {p:.2,position:[0,1.9,5.5],target:[0,2.2,-4]},
  {p:.3,position:[0,1.8,1],target:[0,2.4,-8]},
  {p:.4,position:[0,1.8,-3.2],target:[2,2.2,-7]},
  {p:.48,position:[3.8,2.1,-3.1],target:[3.3,3.8,-1.7]},
  {p:.54,position:[1.2,4.9,2.2],target:[1.5,4.6,-3.5]},
  {p:.63,position:[-1.8,5.15,1.9],target:[-2.6,5.5,-3.4]},
  {p:.67,position:[1.9,8.75,2],target:[2.6,8.6,-3.5]},
  {p:.74,position:[-1.6,8.9,1.8],target:[-2.6,9.1,-3.8]},
  {p:.78,position:[1.6,12.35,2],target:[2.6,12.2,-3.5]},
  {p:.85,position:[-1.9,12.45,1.8],target:[-2.6,12.6,-3.7]},
  {p:.89,position:[1.6,15.9,2],target:[2.7,15.8,-3.5]},
  {p:.95,position:[0,16.1,-1.3],target:[0,15.9,-6]},
  {p:1,position:[0,16.3,-5.2],target:[0,16,-7.5]},
];
function smooth(t){return t*t*(3-2*t)}
function getCameraPose(progress){
  let left=cameraFrames[0],right=cameraFrames.at(-1);
  for(let i=0;i<cameraFrames.length-1;i++)if(progress>=cameraFrames[i].p&&progress<=cameraFrames[i+1].p){left=cameraFrames[i];right=cameraFrames[i+1];break}
  const t=smooth(THREE.MathUtils.clamp((progress-left.p)/(right.p-left.p||1),0,1));
  return {position:new THREE.Vector3().fromArray(left.position).lerp(new THREE.Vector3().fromArray(right.position),t),target:new THREE.Vector3().fromArray(left.target).lerp(new THREE.Vector3().fromArray(right.target),t)};
}
function setSceneProgress(progress){
  scrollProgress=THREE.MathUtils.clamp(progress,0,1);
  const doorT=THREE.MathUtils.smoothstep(scrollProgress,.055,.18);
  doorPivots.forEach(({pivot,side})=>{pivot.rotation.y=side===-1?doorT*-.9:doorT*.9});
  entranceLight.intensity=THREE.MathUtils.lerp(0,1.35,THREE.MathUtils.smoothstep(scrollProgress,.08,.32));
  const elevatorLevel=Math.max(0,floorData.findIndex(floor=>floor.id===floorFromProgress(scrollProgress)));
  elevatorCar.position.y=THREE.MathUtils.damp(elevatorCar.position.y,.5+elevatorLevel*3.6,.08,1/60);
  const pose=categoryCameraTarget||getCameraPose(scrollProgress);
  const cameraEase=reducedMotion?1:.09;
  camera.position.lerp(pose.position,cameraEase);
  const targetEase=reducedMotion?1:.1;currentLook.lerp(pose.target,targetEase);camera.lookAt(currentLook);
  $('#progress-fill').style.width=`${(scrollProgress*100).toFixed(1)}%`;
  $('#progress-percent').textContent=`${Math.round(scrollProgress*100).toString().padStart(2,'0')}%`;
}
function resize(){
  const width=window.innerWidth,height=window.innerHeight;
  camera.aspect=width/height;camera.fov=width<620?51:42;camera.updateProjectionMatrix();renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,width<620?1.25:1.55));renderer.setSize(width,height,false);
}
window.addEventListener('resize',resize);
renderer.setAnimationLoop(()=>{
  if(categoryCameraTarget){camera.position.lerp(categoryCameraTarget.position,.055);currentLook.lerp(categoryCameraTarget.target,.055);camera.lookAt(currentLook)}
  renderer.render(scene,camera);
});

function getProgressFromScroll(){
  const start=journey.offsetTop;const total=journey.offsetHeight-window.innerHeight;
  return total>0?(window.scrollY-start)/total:0;
}
function floorFromProgress(progress){
  if(progress<.50)return 'ground';if(progress<.63)return 'first';if(progress<.74)return 'second';if(progress<.85)return 'third';return 'fourth';
}
function progressForSelectedFloor(progress){
  const ranges={ground:[0,.50],first:[.50,.63],second:[.63,.74],third:[.74,.85],fourth:[.85,1]};
  const [start,end]=ranges[activeFloor]||ranges.ground;
  return THREE.MathUtils.clamp(progress,start,end);
}
function setActiveFloor(id){
  const floor=floorData.find(item=>item.id===id)||floorData[0];if(activeFloor!==floor.id)activeCategory='';activeFloor=floor.id;
  $$('[data-floor-jump]').forEach(button=>{const selected=button.dataset.floorJump===floor.id;button.classList.toggle('active',selected);button.setAttribute('aria-current',selected?'location':'false')});
  $('#active-floor-name').textContent=floor.label;
  $('#active-categories').innerHTML=floor.categories.map(category=>`<span>${category}</span>`).join('');
  $('#dock-floor').textContent=floor.label;
  renderDock();
}
function setActiveChapter(index){
  index=THREE.MathUtils.clamp(index,0,chapters.length-1);if(index===activeChapter&&$('#caption-title').dataset.chapter===String(index))return;
  activeChapter=index;const chapter=chapters[index];
  chapters.forEach((item,i)=>item.classList.toggle('is-active',i===index));
  $('#chapter-index').textContent=`${String(index).padStart(2,'0')} / ${String(chapters.length-1).padStart(2,'0')}`;
  $('#caption-kicker').textContent=chapter.dataset.captionKicker||'';
  $('#caption-title').innerHTML=(chapter.dataset.captionTitle||'').replaceAll('|','<br>');
  $('#caption-title').dataset.chapter=String(index);
  $('#caption-body').textContent=chapter.dataset.captionBody||'';
  $('#caption-action').innerHTML=`${chapter.dataset.captionAction||'KEEP EXPLORING'} <span>↓</span>`;
  $('#caption-action').dataset.index=String(index);
}
function onScroll(){
  const progress=progressForSelectedFloor(THREE.MathUtils.clamp(getProgressFromScroll(),0,1));setSceneProgress(progress);
  const index=progress<.5?Math.min(4,Math.floor(progress*10)):progress<.63?5:progress<.74?6:progress<.85?7:progress<.95?8:9;setActiveChapter(index);
}
window.addEventListener('scroll',onScroll,{passive:true});
setActiveChapter(0);setActiveFloor('ground');onScroll();

function jumpToFloor(id){
  const floor=floorData.find(item=>item.id===id);if(!floor)return;
  routeToken++;
  categoryCameraTarget=null;
  const top=journey.offsetTop+(journey.offsetHeight-window.innerHeight)*floor.progress;
  window.scrollTo({top,behavior:reducedMotion?'auto':'smooth'});
  setActiveFloor(id);$('.product-dock').classList.add('open');
}
function focusCategory(category){
  activeCategory=category;
  categoryCameraTarget=shelfTargets.get(`${floorData.findIndex(floor=>floor.id===activeFloor)}:${category}`)||null;
  updateActiveCategories();renderDock();$('.product-dock').classList.add('open');
}
function jumpToProduct(floorId,category){
  const floor=floorData.find(item=>item.id===floorId);if(!floor)return;
  jumpToFloor(floorId);if(!category)return;
  const token=++routeToken,started=performance.now();
  const waitForFloor=()=>{
    if(token!==routeToken)return;
    if(Math.abs(getProgressFromScroll()-floor.progress)<.025||performance.now()-started>3500){focusCategory(category);return}
    requestAnimationFrame(waitForFloor);
  };
  requestAnimationFrame(waitForFloor);
}
$$('[data-floor-jump]').forEach(button=>button.addEventListener('click',()=>jumpToFloor(button.dataset.floorJump)));

function renderDock(){
  const allFloorItems=products.filter(item=>item.floorId===activeFloor).sort((a,b)=>Number(a.category==='Accessories')-Number(b.category==='Accessories'));
  const items=allFloorItems.filter(item=>!activeCategory||item.category===activeCategory).slice(0,24);
  $('#dock-products').innerHTML=items.map(product=>`<button class="dock-product" data-product-id="${escapeHtml(product.id)}" aria-label="View ${escapeHtml(product.name)}"><img src="${safeImage(product.image)}" alt="" loading="lazy"/><strong>${escapeHtml(product.name)}</strong><small>₹${Number(product.price).toLocaleString('en-IN')} · ${escapeHtml(product.color)}</small></button>`).join('');
  const floor=floorData.find(item=>item.id===activeFloor);$('#dock-title').textContent=activeCategory||floor?.title||'New arrivals';
}
function readCart(){try{return JSON.parse(localStorage.getItem('maison-form-cart')||'[]')}catch{return []}}
function saveCart(){try{localStorage.setItem('maison-form-cart',JSON.stringify(cart))}catch{}}
function renderCart(){
  const count=cart.reduce((sum,item)=>sum+item.qty,0);$$('.bag-count').forEach(node=>node.textContent=String(count));$('.bag-total-count').textContent=`(${count})`;
  $('#bag-lines').innerHTML=cart.map((item,index)=>{const product=productsById.get(item.id)||products.find(entry=>entry.id===item.id);if(!product)return '';return `<article class="bag-line"><img src="${product.image}" alt=""><div><b>${product.name}</b><small>${product.color} · size ${item.size}</small><div class="bag-quantity"><button data-cart-change="${index}" data-delta="-1" aria-label="Remove one">−</button><span>${item.qty}</span><button data-cart-change="${index}" data-delta="1" aria-label="Add one">+</button><button class="bag-remove" data-cart-remove="${index}">Remove</button></div></div><strong>₹${(product.price*item.qty).toLocaleString('en-IN')}</strong></article>`}).join('');
  $('#bag-empty').hidden=count!==0;$('#bag-subtotal').textContent=`₹${cart.reduce((sum,item)=>sum+(productsById.get(item.id)||products.find(entry=>entry.id===item.id))?.price*item.qty||0,0).toLocaleString('en-IN')}`;
}
function showBag(){renderCart();$('#bag-drawer').classList.add('open');$('#bag-drawer').setAttribute('aria-hidden','false');$('#bag-scrim').classList.add('visible')}
function hideBag(){$('#bag-drawer').classList.remove('open');$('#bag-drawer').setAttribute('aria-hidden','true');$('#bag-scrim').classList.remove('visible')}
function addToBag(){
  if(!selectedProduct)return;if(!selectedSize){$('#size-error').textContent='Choose a size first.';return}
  const line=cart.find(item=>item.id===selectedProduct.id&&item.size===selectedSize);if(line)line.qty++;else cart.push({id:selectedProduct.id,size:selectedSize,qty:1});
  saveCart();renderCart();$('#product-modal').close();showToast(`${selectedProduct.name} added to your bag`);
}
function showToast(message){const toast=$('#toast');toast.textContent=message;toast.classList.add('show');clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>toast.classList.remove('show'),2300)}
function showDock(){renderDock();$('.product-dock').classList.add('open')}
function hideDock(){$('.product-dock').classList.remove('open')}
$('#dock-products').addEventListener('click',event=>{const button=event.target.closest('[data-product-id]');if(button)openProduct(button.dataset.productId)});
$('.dock-close').addEventListener('click',hideDock);
$('#caption-action').addEventListener('click',()=>{
  const index=Number($('#caption-action').dataset.index);const chapter=chapters[index];
  if(chapter?.dataset.scene==='close'){$('.stylist').classList.add('is-open');$('#stylist-panel').hidden=false;$('.stylist-launch').setAttribute('aria-expanded','true');$('#stylist-input').focus();return}
  if(index<5){const next=Math.min(index+1,chapters.length-1);chapters[next].scrollIntoView({behavior:reducedMotion?'instant':'smooth'});return}
  showDock();
});

function openProduct(id){
  const product=productsById.get(id)||products.find(item=>item.id===id);if(!product)return;selectedProduct=product;selectedSize='';
  const floor=floorData.find(item=>item.id===product.floorId);
  $('#modal-photo').src=product.image;$('#modal-photo').alt=`${product.color} ${product.name}`;$('.modal-photo-wrap').dataset.category=product.category;
  $('#modal-floor').textContent=`${floor?.label||'MAISON FORM'} · ${product.audience}`;
  $('#modal-name').textContent=product.name;$('#modal-description').textContent=product.description;
  $('#modal-color').textContent=`COLOUR · ${product.color}`;$('#modal-fit').textContent=`FIT · ${product.fit}`;
  $('#modal-price').textContent=`₹${Number(product.price).toLocaleString('en-IN')}`;
  $('#modal-sizes').innerHTML=product.sizes.map(size=>`<button class="size-pill" data-size="${size}" aria-pressed="false">${size}</button>`).join('');$('#size-error').textContent='';$('#add-to-bag').disabled=true;
  $('#product-modal').showModal();
}
$('#dock-products').addEventListener('keydown',event=>{if(event.key==='Escape')hideDock()});
$('#product-modal').addEventListener('click',event=>{if(event.target===event.currentTarget)event.currentTarget.close()});
$('.modal-close').addEventListener('click',()=>$('#product-modal').close());
$('#modal-sizes').addEventListener('click',event=>{const button=event.target.closest('[data-size]');if(!button)return;selectedSize=button.dataset.size;$$('.size-pill').forEach(item=>{const active=item===button;item.classList.toggle('selected',active);item.setAttribute('aria-pressed',String(active))});$('#size-error').textContent='';$('#add-to-bag').disabled=false});
$('#add-to-bag').addEventListener('click',addToBag);
$('.bag-toggle').addEventListener('click',showBag);$('.bag-close').addEventListener('click',hideBag);$('#bag-scrim').addEventListener('click',hideBag);$('#bag-lines').addEventListener('click',event=>{const remove=event.target.closest('[data-cart-remove]'),change=event.target.closest('[data-cart-change]');if(remove)cart.splice(Number(remove.dataset.cartRemove),1);if(change){const item=cart[Number(change.dataset.cartChange)];if(item){item.qty+=Number(change.dataset.delta);if(item.qty<=0)cart.splice(Number(change.dataset.cartChange),1)}}saveCart();renderCart()});
$('#checkout-preview').addEventListener('click',()=>showToast('Checkout preview only · no order or payment is sent'));
renderCart();

function addChatMessage(text,kind='assistant-message'){
  const message=document.createElement('div');message.className=`chat-message ${kind}`;message.textContent=text;$('#chat-messages').append(message);$('#chat-messages').scrollTop=$('#chat-messages').scrollHeight;return message;
}
function addProductToMessage(parent,product){
  const card=document.createElement('button');card.className='chat-product';card.dataset.productId=product.id;const image=document.createElement('img');image.src=safeImage(product.image);image.alt='';const text=document.createElement('span'),name=document.createElement('b'),meta=document.createElement('small');name.textContent=product.name;meta.textContent=`${product.color} · ₹${Number(product.price).toLocaleString('en-IN')}`;text.append(name,meta);card.append(image,text);parent.append(card);
}
function localRecommendation(message){
  const text=message.toLowerCase();let floorId=/\b(pants?|trousers?|jeans?|denim|shirts?|tees?|jackets?|blazers?)\b/.test(text)?'first':'ground';
  if(/grand|grandparent|senior|दादा|दादी|नाना|नानी|बुजुर्ग/.test(text))floorId='fourth';
  else if(/child|kid|children|बच्च|बेटा|बेटी/.test(text))floorId='third';
  else if(/woman|women|female|ladies|महिल|औरत|लड़क/.test(text))floorId='second';
  else if(/man|men|male|mens|पुरुष|आदमी|लड़के/.test(text))floorId='first';
  const floorItems=products.filter(item=>item.floorId===floorId);
  const wantsBottoms=/\b(pants?|trousers?|jeans?|denim|bottoms)\b/.test(text);
  const matched=floorItems.filter(item=>{
    if(wantsBottoms&&/trouser|jean/i.test(item.category))return true;
    const itemText=`${item.name} ${item.category} ${item.fit} ${item.color} ${item.fabric} ${item.description}`.toLowerCase();
    return itemText.split(/\W+/).some(word=>word.length>3&&text.includes(word));
  });
  return {floorId,products:(matched.length?matched:floorItems).slice(0,3),reply:`I’d start on the ${floorData.find(item=>item.id===floorId).title.toLowerCase()}. I’m taking you there now. This is a local guide preview until the Gemini key is configured.`};
}
async function askStylist(message){
  if(busy)return;busy=true;$('#stylist-form button').disabled=true;addChatMessage(message,'user-message');
  aiHistory.push({role:'user',text:message});
  const waiting=addChatMessage('Let me find the right place in the house…');waiting.innerHTML='<span class="typing-dots"><i></i><i></i><i></i></span>';
  try{
    const response=await fetch('/api/stylist',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message,history:aiHistory.slice(-6)})});
    if(!response.ok)throw new Error(response.status===503?'preview':'The stylist is having trouble reaching the catalogue.');
    const result=await response.json();waiting.textContent=result.reply;
    if(result.products?.length){result.products.forEach(product=>addProductToMessage(waiting,product))}
    const floor=floorData.find(item=>item.id===result.floorId)||floorData[0];
    const category=result.products?.[0]?.category;
    const route=document.createElement('button');route.className='take-me-there';route.textContent=`TAKE ME TO ${floor.label} ↗`;route.addEventListener('click',()=>{jumpToProduct(floor.id,category);$('.stylist').classList.remove('is-open');$('#stylist-panel').hidden=true;$('.stylist-launch').setAttribute('aria-expanded','false')});waiting.append(route);
    aiHistory.push({role:'assistant',text:result.reply});
    $('#stylist-footnote').textContent='Gemini stylist · catalogue-aware recommendations';
    jumpToProduct(floor.id,category);
  }catch(error){
    if(error.message==='preview'){
      const fallback=localRecommendation(message);waiting.textContent=fallback.reply;
      fallback.products.forEach(product=>addProductToMessage(waiting,product));
      const floor=floorData.find(item=>item.id===fallback.floorId);
      const category=fallback.products[0]?.category;
      const route=document.createElement('button');route.className='take-me-there';route.textContent=`TAKE ME TO ${floor.label} ↗`;route.addEventListener('click',()=>jumpToProduct(floor.id,category));waiting.append(route);jumpToProduct(floor.id,category);
      $('#stylist-footnote').textContent='Local preview guide · add Gemini and MongoDB settings for live catalogue answers';
    }else{waiting.textContent=error.message;$('#stylist-footnote').textContent='Try again, or choose a floor from the guide.'}
  }finally{busy=false;$('#stylist-form button').disabled=false;$('#stylist-input').value='';$('#stylist-input').focus()}
}
$('#stylist-form').addEventListener('submit',event=>{event.preventDefault();const message=$('#stylist-input').value.trim();if(message)askStylist(message)});
$$('[data-prompt]').forEach(button=>button.addEventListener('click',()=>askStylist(button.dataset.prompt)));
$('.stylist-launch').addEventListener('click',()=>{$('.stylist').classList.add('is-open');$('#stylist-panel').hidden=false;$('.stylist-launch').setAttribute('aria-expanded','true');$('#stylist-input').focus()});
$('.stylist-close').addEventListener('click',()=>{$('.stylist').classList.remove('is-open');$('#stylist-panel').hidden=true;$('.stylist-launch').setAttribute('aria-expanded','false')});
$('#chat-messages').addEventListener('click',event=>{const product=event.target.closest('[data-product-id]');if(product)openProduct(product.dataset.productId)});

function handleSceneClick(event){
  const rect=canvas.getBoundingClientRect();pointer.x=((event.clientX-rect.left)/rect.width)*2-1;pointer.y=-((event.clientY-rect.top)/rect.height)*2+1;
  raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObjects(clickable,true)[0];if(!hit)return;
  let node=hit.object;while(node&&!node.userData.productId)node=node.parent;
  if(node?.userData.productId)openProduct(node.userData.productId);
}
canvas.addEventListener('pointerup',handleSceneClick);
canvas.addEventListener('pointermove',event=>{const rect=canvas.getBoundingClientRect();pointer.x=((event.clientX-rect.left)/rect.width)*2-1;pointer.y=-((event.clientY-rect.top)/rect.height)*2+1;raycaster.setFromCamera(pointer,camera);canvas.style.cursor=raycaster.intersectObjects(clickable,true).length?'pointer':'default'});

$('#stylist-input').addEventListener('keydown',event=>{if(event.key==='Escape'){$('.stylist').classList.remove('is-open');$('#stylist-panel').hidden=true}});
window.addEventListener('keydown',event=>{if(event.key==='Escape')$('#product-modal').close()});
$('#caption-action').setAttribute('aria-label','Continue through the virtual store');

async function loadCatalog(){
  try{const response=await fetch('/api/products');if(!response.ok)throw new Error('catalog offline');const payload=await response.json();products=payload.items||[];$('#stylist-footnote').textContent=payload.source==='mongodb'?'Connected to the Maison Form catalogue':'Recommendations are based on the current demo catalogue.';$('#stylist-status-text').textContent=payload.source==='mongodb'?'Connected to the live product catalogue':'Here to help you explore the demo house'}
  catch{products=[];$('#stylist-footnote').textContent='Catalog preview unavailable. Start the local app to enter the house.'}
  productsById=new Map(products.map(item=>[item.id,item]));renderDock();renderCart();
  for(let i=0;i<5;i++)buildFloorScene(floorData[i].id,i);
  updateActiveCategories();
}
function updateActiveCategories(){
  const floor=floorData.find(item=>item.id===activeFloor)||floorData[0];
  const available=[...new Set(products.filter(item=>item.floorId===floor.id).map(item=>item.category))];
  const categories=available.length?available:floor.categories;
  $('#active-categories').innerHTML=categories.slice(0,8).map(category=>`<button class="category-chip${activeCategory===category?' active':''}" data-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`).join('');
}
$('#active-categories').addEventListener('click',event=>{
  const button=event.target.closest('[data-category]');if(!button)return;
  routeToken++;
  if(activeCategory===button.dataset.category){activeCategory='';categoryCameraTarget=null;updateActiveCategories();renderDock()}
  else focusCategory(button.dataset.category);
});
window.addEventListener('wheel',()=>{routeToken++;categoryCameraTarget=null},{passive:true});
window.addEventListener('touchstart',()=>{routeToken++;categoryCameraTarget=null},{passive:true});
const originalSetActiveFloor=setActiveFloor;
setActiveFloor=function(id){originalSetActiveFloor(id);updateActiveCategories()};
loadCatalog();

// WebGL can be unavailable on older devices; the page keeps floor, catalogue and stylist controls usable.
renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();$('#caption-body').textContent='The 3D view paused. Use the floor guide to keep exploring.'});
