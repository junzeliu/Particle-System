/**
 * @fileoverview Utilities for implementing a particle system.
 * @Junze Liu junzel2@illinois.edu
 */

var gl;
var canvas;
var shaderProgram;
var vertexPositionBuffer;

var days=0;


// Create a place to store sphere geometry
var sphereVertexPositionBuffer;

//Create a place to store normals for shading
var sphereVertexNormalBuffer;

// View parameters
var eyePt = vec3.fromValues(0.0,-3.0,120.0);
var viewDir = vec3.fromValues(0.0,0.0,-1.0);
var up = vec3.fromValues(0.0,1.0,0.0);
var viewPt = vec3.fromValues(0.0,0.0,0.0);
var lastTime = 0;
var time_expand = 0.00001; 
var gravity = -5.0; 
var boundary = 50;
var dv=vec3.create(); 
var v=vec3.create(); 
var ds=vec3.create(); 
var p=vec3.create(); 
var friction = 0.9; 

// Create the normal
var nMatrix = mat3.create();

// Create ModelView matrix
var mvMatrix = mat4.create();

//Create Projection matrix
var pMatrix = mat4.create();

var mvMatrixStack = [];

var particles = []; 

//-------------------------------------------------------------------------
/**
  * Setup Sphere Buffers
  */
function setupSphereBuffers() {
    
    var sphereSoup=[];
    var sphereNormals=[];
    var numT=sphereFromSubdivision(6,sphereSoup,sphereNormals);
    console.log("Generated ", numT, " triangles"); 
    sphereVertexPositionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, sphereVertexPositionBuffer);      
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sphereSoup), gl.STATIC_DRAW);
    sphereVertexPositionBuffer.itemSize = 3;
    sphereVertexPositionBuffer.numItems = numT*3;
    console.log(sphereSoup.length/9);
    
    // Specify normals to be able to do lighting calculations
    sphereVertexNormalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, sphereVertexNormalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sphereNormals),
                  gl.STATIC_DRAW);
    sphereVertexNormalBuffer.itemSize = 3;
    sphereVertexNormalBuffer.numItems = numT*3;
    
    console.log("Normals ", sphereNormals.length/3);     
}

//-------------------------------------------------------------------------
/**
  * Draw shperes
  */
function drawSphere(){
 gl.bindBuffer(gl.ARRAY_BUFFER, sphereVertexPositionBuffer);
 gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, sphereVertexPositionBuffer.itemSize, 
                         gl.FLOAT, false, 0, 0);

 // Bind normal buffer
 gl.bindBuffer(gl.ARRAY_BUFFER, sphereVertexNormalBuffer);
 gl.vertexAttribPointer(shaderProgram.vertexNormalAttribute, 
                           sphereVertexNormalBuffer.itemSize,
                           gl.FLOAT, false, 0, 0);
 gl.drawArrays(gl.TRIANGLES, 0, sphereVertexPositionBuffer.numItems);      
}

//-------------------------------------------------------------------------
function uploadModelViewMatrixToShader() {
  gl.uniformMatrix4fv(shaderProgram.mvMatrixUniform, false, mvMatrix);
}

//-------------------------------------------------------------------------
function uploadProjectionMatrixToShader() {
  gl.uniformMatrix4fv(shaderProgram.pMatrixUniform, 
                      false, pMatrix);
}

//-------------------------------------------------------------------------
function uploadNormalMatrixToShader() {
  mat3.fromMat4(nMatrix,mvMatrix);
  mat3.transpose(nMatrix,nMatrix);
  mat3.invert(nMatrix,nMatrix);
  gl.uniformMatrix3fv(shaderProgram.nMatrixUniform, false, nMatrix);
}

//----------------------------------------------------------------------------------
function mvPushMatrix() {
    var copy = mat4.clone(mvMatrix);
    mvMatrixStack.push(copy);
}


//----------------------------------------------------------------------------------
function mvPopMatrix() {
    if (mvMatrixStack.length == 0) {
      throw "Invalid popMatrix!";
    }
    mvMatrix = mvMatrixStack.pop();
}

//----------------------------------------------------------------------------------
function setMatrixUniforms() {
    uploadModelViewMatrixToShader();
    uploadNormalMatrixToShader();
    uploadProjectionMatrixToShader();
}

//----------------------------------------------------------------------------------
function degToRad(degrees) {
        return degrees * Math.PI / 180;
}

//----------------------------------------------------------------------------------
function createGLContext(canvas) {
  var names = ["webgl", "experimental-webgl"];
  var context = null;
  for (var i=0; i < names.length; i++) {
    try {
      context = canvas.getContext(names[i]);
    } catch(e) {}
    if (context) {
      break;
    }
  }
  if (context) {
    context.viewportWidth = canvas.width;
    context.viewportHeight = canvas.height;
  } else {
    alert("Failed to create WebGL context!");
  }
  return context;
}

//----------------------------------------------------------------------------------
function loadShaderFromDOM(id) {
  var shaderScript = document.getElementById(id);
  
  // If we don't find an element with the specified id
  // we do an early exit 
  if (!shaderScript) {
    return null;
  }
  
  // Loop through the children for the found DOM element and
  // build up the shader source code as a string
  var shaderSource = "";
  var currentChild = shaderScript.firstChild;
  while (currentChild) {
    if (currentChild.nodeType == 3) { // 3 corresponds to TEXT_NODE
      shaderSource += currentChild.textContent;
    }
    currentChild = currentChild.nextSibling;
  }
 
  var shader;
  if (shaderScript.type == "x-shader/x-fragment") {
    shader = gl.createShader(gl.FRAGMENT_SHADER);
  } else if (shaderScript.type == "x-shader/x-vertex") {
    shader = gl.createShader(gl.VERTEX_SHADER);
  } else {
    return null;
  }
 
  gl.shaderSource(shader, shaderSource);
  gl.compileShader(shader);
 
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert(gl.getShaderInfoLog(shader));
    return null;
  } 
  return shader;
}

//----------------------------------------------------------------------------------
function setupShaders() {
  vertexShader = loadShaderFromDOM("shader-vs");
  fragmentShader = loadShaderFromDOM("shader-fs");
  
  shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);

  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    alert("Failed to setup shaders");
  }

  gl.useProgram(shaderProgram);

  shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition");
  gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);

  shaderProgram.vertexNormalAttribute = gl.getAttribLocation(shaderProgram, "aVertexNormal");
  gl.enableVertexAttribArray(shaderProgram.vertexNormalAttribute);

  shaderProgram.mvMatrixUniform = gl.getUniformLocation(shaderProgram, "uMVMatrix");
  shaderProgram.pMatrixUniform = gl.getUniformLocation(shaderProgram, "uPMatrix");
  shaderProgram.nMatrixUniform = gl.getUniformLocation(shaderProgram, "uNMatrix");
    
  shaderProgram.uniformLightPositionLoc = gl.getUniformLocation(shaderProgram, "uLightPosition");    
  shaderProgram.uniformAmbientLightColorLoc = gl.getUniformLocation(shaderProgram, "uAmbientLightColor");  
  shaderProgram.uniformDiffuseLightColorLoc = gl.getUniformLocation(shaderProgram, "uDiffuseLightColor");
  shaderProgram.uniformSpecularLightColorLoc = gl.getUniformLocation(shaderProgram, "uSpecularLightColor");
    
  shaderProgram.uniformAmbientMatColorLoc = gl.getUniformLocation(shaderProgram, "uAmbientMatColor");  
  shaderProgram.uniformDiffuseMatColorLoc = gl.getUniformLocation(shaderProgram, "uDiffuseMatColor");
  shaderProgram.uniformSpecularMatColorLoc = gl.getUniformLocation(shaderProgram, "uSpecularMatColor");    
    
}

//-------------------------------------------------------------------------
/**
  * Generate a random number
  * @param {Number} Minimum
  * @param {Number} Maximum
  * @param {Number} Specify log(decimals) decimals
  * @param {Number} Random number in the range of [min, max] with log(decimals) decimals
  */
function getRandom2Decimals(min, max, decimals) {
  return Math.round(Math.random() * (max - min) * decimals) / decimals + min; //The maximum is exclusive and the minimum is inclusive
}

//-------------------------------------------------------------------------
/**
  * Initialize a particle, and push it into the particle arrays
  */
function setupParticles() {
  var p = vec3.fromValues(getRandom2Decimals(-0.9*boundary,0.9*boundary,10000),getRandom2Decimals(-0.9*boundary,0.9*boundary,10000),getRandom2Decimals(-0.9*boundary,0.9*boundary,10000));
  var v = vec3.fromValues(300*getRandom2Decimals(-0.5,0.5, 10000),300*getRandom2Decimals(-0.5,1,10000),300*getRandom2Decimals(0.0,0.5,10000)); 
  var a = vec3.fromValues(0,-1,0); 
  // var c = vec3.fromValues(1.0,0.3,0.5); 
  var c = vec3.fromValues(getRandom2Decimals(0,1,1000),getRandom2Decimals(0,1,1000),getRandom2Decimals(0,1,1000)); 
  var r = 1.5; 
  var t = Date.now(); 
  const particle = new Particle(p,v,a,c,r,t); 
  particles.push(particle); 
}

//-------------------------------------------------------------------------
/**
  * Clear all the particles (called by button event)
  */
function resetParticles() {
  dv.set(vec3.fromValues(0.0,0.0,0.0)); 
  v.set(vec3.fromValues(0.0,0.0,0.0)); 
  ds.set(vec3.fromValues(0.0,0.0,0.0)); 
  p.set(vec3.fromValues(0.0,0.0,0.0)); 
  particles = []; 
}

//-------------------------------------------------------------------------
/**
  * Update the velocity and postion of a particle
  * @param {Object} Particle object
  */
function updateParticle(particle) {
  // console.log(particle.v); 
  dv.set(vec3.fromValues(0.0,0.0,0.0)); 
  v.set(vec3.fromValues(0.0,0.0,0.0)); 
  ds.set(vec3.fromValues(0.0,0.0,0.0)); 
  p.set(vec3.fromValues(0.0,0.0,0.0)); 
  // particle.t = Date.now(); 
  // vec3.scale(dv, particle.a, days); 
  vec3.scale(dv, particle.a, time_expand*(Date.now() - particle.t)); 
  vec3.add(v, particle.v, dv); 
  // vec3.scale(v, v, Math.pow(friction, days));
  vec3.scale(v, v, Math.pow(friction, time_expand*(Date.now() - particle.t)));
  particle.v.set(v); 
  // vec3.scale(ds, v, days);
  vec3.scale(ds, v, time_expand*(Date.now() - particle.t)); 
  vec3.add(p,particle.p,ds); 
  particle.p.set(p); 
  particle.v.set(v); 
}

//-------------------------------------------------------------------------
/**
  * Check the collision between particles and walls
  * Update the velocity and postion of a particle according to collision physics
  * @param {Object} Particle object
  */
function updateCollision(particle) {
  if (particle.p[0] >= boundary || particle.p[0] <= -boundary) {
    particle.v[0] = particle.v[0]*(-0.99);
  } 
  if (particle.p[1] >= boundary || particle.p[1] <= -boundary) {
    particle.v[1] = particle.v[1]*(-0.99);
    if (particle.p[1] <= -boundary && Math.abs(particle.v[1]) < 0.001) {
      particle.a[1] = 0; 
      particle.v[1] = 0; 
    }
    if (particle.p[1] <= -boundary-0.01*boundary) {
      particle.a[1] = 0; 
      particle.v[1] = 0; 
      particle.p[1] = -boundary-0.01*boundary; 
    }
  } 
  if (particle.p[2] >= boundary || particle.p[2] <= -boundary) {
    particle.v[2] = particle.v[2]*(-0.99);
  } 
}

//-------------------------------------------------------------------------
function uploadLightsToShader(loc,a,d,s) {
  gl.uniform3fv(shaderProgram.uniformLightPositionLoc, loc);
  gl.uniform3fv(shaderProgram.uniformAmbientLightColorLoc, a);
  gl.uniform3fv(shaderProgram.uniformDiffuseLightColorLoc, d);
  gl.uniform3fv(shaderProgram.uniformSpecularLightColorLoc, s);
}

//-------------------------------------------------------------------------
function uploadMaterialToShader(a,d,s) {
  gl.uniform3fv(shaderProgram.uniformAmbientMatColorLoc, a);
  gl.uniform3fv(shaderProgram.uniformDiffuseMatColorLoc, d);
  gl.uniform3fv(shaderProgram.uniformSpecularMatColorLoc, s);
}


//----------------------------------------------------------------------------------
function setupBuffers() {
    setupSphereBuffers();     
}

//-------------------------------------------------------------------------
/**
  * Called by left mouse click event
  * Call setupParticles() to generate a particle
  */
function detectLeftButton() {
    setupParticles(); 
  }

//-------------------------------------------------------------------------
/**
  * Update the gravity value
  * Update the accelerate of each particle in particles array
  * @param {Number} new gravity
  */
function setupGravity(gravity) {
  for (i=0;i<particles.length;i++) {
    particles[i].a.set(vec3.fromValues(0.0,gravity,0.0));  
  }
}

//----------------------------------------------------------------------------------
function draw() { 

    if(document.getElementById("gravity").checked){
      gravity = -5.0;
      setupGravity(gravity); 
    }
    if(document.getElementById("space").checked){
      gravity = 0.0;
      setupGravity(gravity);
    }

    var transformVec = vec3.create();
  
    gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // We'll use perspective 
    mat4.perspective(pMatrix,degToRad(90), gl.viewportWidth / gl.viewportHeight, 0.1, 200.0);

    // We want to look down -z, so create a lookat point in that direction    
    vec3.add(viewPt, eyePt, viewDir);
    // Then generate the lookat matrix and initialize the MV matrix to that view
    mat4.lookAt(mvMatrix,eyePt,viewPt,up);    
 
    // Set up light parameters
    var Ia = vec3.fromValues(1.0,1.0,1.0);
    var Id = vec3.fromValues(1.0,1.0,1.0);
    var Is = vec3.fromValues(1.0,1.0,1.0);
    
    var lightPosEye4 = vec4.fromValues(1.0,1.0,50.0,1.0);
    lightPosEye4 = vec4.transformMat4(lightPosEye4,lightPosEye4,mvMatrix);
    //console.log(vec4.str(lightPosEye4))
    var lightPosEye = vec3.fromValues(lightPosEye4[0],lightPosEye4[1],lightPosEye4[2]);
    uploadLightsToShader(lightPosEye,Ia,Id,Is);
    // Set up material parameters
    var ka = vec3.fromValues(0.0,0.0,0.0);
    var kd = vec3.fromValues(0.0,0.9,0.5);
    var ks = vec3.fromValues(0.0,0.9,0.5);

    uploadMaterialToShader(ka, kd, ks); 

    // setMatrixUniforms();

    for (i=0; i<particles.length; i++) {
      var particle = particles[i]; 

      mvPushMatrix(); 
      ka = particle.c; 
      uploadMaterialToShader(ka, kd, ks); 
      updateParticle(particles[i]); 
      updateCollision(particles[i]); 
      mat4.translate(mvMatrix, mvMatrix, p); 

      mvPushMatrix(); 
      mat4.scale(mvMatrix, mvMatrix, vec3.fromValues(particle.r, particle.r, particle.r)); 
      setMatrixUniforms(); 
      drawSphere(); 
      mvPopMatrix();

      mvPopMatrix();
    }

    // updateCollision(particles); 
}

//----------------------------------------------------------------------------------
function animate() {
    if (lastTime == 0) {
      lastTime = Date.now(); 
    }
    else {
      days = (Date.now() - lastTime) * 0.0001; 
    }
    // days=days+0.001;
  }
    

//----------------------------------------------------------------------------------
function startup() {
  canvas = document.getElementById("myGLCanvas");
  gl = createGLContext(canvas);
  canvas.onmousedown = detectLeftButton; 
  document.getElementById('myButton').onlick = resetParticles; 
  setupShaders();
  setupBuffers();
  gl.clearColor(0.1, 0.1, 0.2, 1.0);
  gl.enable(gl.DEPTH_TEST);
  tick();
}

//----------------------------------------------------------------------------------
function tick() {
    requestAnimFrame(tick);
    draw();
    animate();
}

