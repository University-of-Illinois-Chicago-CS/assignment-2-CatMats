import vertexShaderSrc from './vertex.glsl.js';
import fragmentShaderSrc from './fragment.glsl.js'

var gl = null;
var vao_S = null, vao_W = null;
var program = null;
var vertexCount_S = 0, vertexCount_W = 0;
var uniformModelViewLoc = null;
var uniformProjectionLoc = null;
var heightmapData = null;

var meshHeight = 1;
window.updateHeight = function() {
    meshHeight = parseInt(document.querySelector("#height").value) / 50;
    console.log("current model scale: " + meshHeight);
}

var useWire = false;
window.checkBox = function() {
    useWire = document.querySelector("#checkbox").checked;
}

var zoomVal = 0;
// window.updateZoom = function(){
// 	zoomVal = parseInt(document.querySelector("#scale").value) / 50;
// 	console.log("current zoom value: " + zoomVal);
// }

var panXVal = 0;
// window.updatePanX = function(){
// 	panXVal = parseInt(document.querySelector("#panX").value) * (Math.PI / 180);
// }

var panZVal = 0;
// window.updatePanZ = function(){
// 	panZVal = parseInt(document.querySelector("#panZ").value) * (Math.PI / 180);
// }

var rotYVal = 0;
// window.updateRotY = function(){
// 	rotYVal = parseInt(document.querySelector("#rotationY").value) * (Math.PI / 180);
// }

var rotXVal = 0;
// window.updateRotX = function(){
// 	rotXVal = parseInt(document.querySelector("#rotationX").value) * (Math.PI / 180);
// }

function processImage(img)
{
	// draw the image into an off-screen canvas
	var off = document.createElement('canvas');
	
	var sw = img.width, sh = img.height;
	off.width = sw; off.height = sh;
	
	var ctx = off.getContext('2d');
	ctx.drawImage(img, 0, 0, sw, sh);
	
	// read back the image pixel data
	var imgd = ctx.getImageData(0,0,sw,sh);
	var px = imgd.data;
	
	// create a an array will hold the height value
	var heightArray = new Float32Array(sw * sh);
	
	// loop through the image, rows then columns
	for (var y=0;y<sh;y++) 
	{
		for (var x=0;x<sw;x++) 
		{
			// offset in the image buffer
			var i = (y*sw + x)*4;
			
			// read the RGB pixel value
			var r = px[i+0], g = px[i+1], b = px[i+2];
			
			// convert to greyscale value between 0 and 1
			var lum = (0.2126*r + 0.7152*g + 0.0722*b) / 255.0;

			// store in array
			heightArray[y*sw + x] = lum;
		}
	}

	return {
		data: heightArray,
		width: sw,
		height: sh
	};
}


window.loadImageFile = function(event)
{

	var f = event.target.files && event.target.files[0];
	if (!f) return;
	
	// create a FileReader to read the image file
	var reader = new FileReader();
	reader.onload = function() 
	{
		// create an internal Image object to hold the image into memory
		var img = new Image();
		img.onload = function() 
		{
			// heightmapData is globally defined
			heightmapData = processImage(img);
			
			/*
				TODO: using the data in heightmapData, create a triangle mesh
					heightmapData.data: array holding the actual data, note that 
					this is a single dimensional array the stores 2D data in row-major order

					heightmapData.width: width of map (number of columns)
					heightmapData.height: height of the map (number of rows)
			*/

			//positions to hold all potential vertices
			const positions_S = [];
			const positions_W = [];

			//obtain width and height from the mapdata
    		const w = heightmapData.width;
    		const h = heightmapData.height;

			
			for (let z = 0; z < h - 1; z++) {
				for (let x = 0; x < w - 1; x++) {
					//get height values for the four corners of a quad
					const y_tl = heightmapData.data[z * w + x];
					const y_tr = heightmapData.data[z * w + (x + 1)];
					const y_bl = heightmapData.data[(z + 1) * w + x];
					const y_br = heightmapData.data[(z + 1) * w + (x + 1)];

					//normalize x and z coordinates to the [-1, 1] range
					const x1 = -1.0 + (x / (w - 1)) * 2.0;
					const z1 = -1.0 + (z / (h - 1)) * 2.0;
					const x2 = -1.0 + ((x + 1) / (w - 1)) * 2.0;
					const z2 = -1.0 + ((z + 1) / (h - 1)) * 2.0;

					//contain the 4 vertices of the quad
					const v_tl = [x1, y_tl, z1];
                    const v_tr = [x2, y_tr, z1];
                    const v_bl = [x1, y_bl, z2];
                    const v_br = [x2, y_br, z2];

					//making two triangles for the quad
					//triangle 1: Top-left, Bottom-left, Top-right
					//For solid forme.
					positions_S.push(...v_tl,...v_bl,...v_tr);
					//For wired forme.
					//line 1: Top-left, Top-right
					//line 2: Top-left, Bottom-left
					positions_W.push(...v_tl,...v_tr,...v_tl,...v_bl);
					//triangle 2: Top-right, Bottom-left, Bottom-right
					//For solid forme.
					positions_S.push(...v_tr,...v_bl,...v_br);
					//For wired forme.
					//line 3: Bottom-right, Top-right
					//line 4: Bottom-right, Bottom-left
					positions_W.push(...v_br,...v_tr,...v_br,...v_bl);
				}
			}
			
			//update vertexCount with total number of positions
			vertexCount_S = positions_S.length / 3;
			vertexCount_W = positions_W.length / 3;
			

			var posAttribLoc = gl.getAttribLocation(program, "position");


			var posBuffer_S = createBuffer(gl, gl.ARRAY_BUFFER, new Float32Array(positions_S));
			vao_S = createVAO(gl, posAttribLoc, posBuffer_S, null, null, null, null);

			var posBuffer_W = createBuffer(gl, gl.ARRAY_BUFFER, new Float32Array(positions_W));
			vao_W = createVAO(gl, posAttribLoc, posBuffer_W, null, null, null, null);

			console.log('loaded image: ' + heightmapData.width + ' x ' + heightmapData.height);
    		console.log("total vertices generated for triangles : " + vertexCount_S);
			console.log("total vertices generated for lines : " + vertexCount_W);
			
			//Adjust camera to be set into default values after loading file.
			zoomVal = 0;
			panXVal = 0, panZVal = 0;
			rotYVal = 0, rotXVal = 0;
		};
		img.onerror = function() 
		{
			console.error("Invalid image file.");
			alert("The selected file could not be loaded as an image.");
		};

		// the source of the image is the data load from the file
		img.src = reader.result;
	};
	reader.readAsDataURL(f);
}


function setupViewMatrix(eye, target)
{
    var forward = normalize(subtract(target, eye));
    var upHint  = [0, 1, 0];

    var right = normalize(cross(forward, upHint));
    var up    = cross(right, forward);

    var view = lookAt(eye, target, up);
    return view;

}
function draw()
{

	var fovRadians = 70 * Math.PI / 180;
	var aspectRatio = +gl.canvas.width / +gl.canvas.height;
	var nearClip = 0.001;
	var farClip = 20.0;

	// perspective projection
	var projectionMatrix;
	if (document.querySelector("#projection").value == 'perspective')
	{
		projectionMatrix= perspectiveMatrix(
			fovRadians,
			aspectRatio,
			nearClip,
			farClip,
		);
	}
	else {
		var unitClose = 5;
		projectionMatrix = orthographicMatrix(
			-unitClose / zoomVal,
			unitClose / zoomVal ,
			-(unitClose / aspectRatio) / zoomVal,
			(unitClose / aspectRatio) / zoomVal,
			nearClip - 4,
			farClip,
		 );
	}

	// eye and target
	var eye = [0, 5, 5];
	var target = [0, 0, 0];


	//The matrix defined for the model in the scene (At start, a cube. at file loading, a mesh.)
	var modelMatrix = identityMatrix();

	// TODO: set up transformations to the model
	
	//SCALE - Scaling the model/mesh's height in the y axis. applying it with multiploication after
	var scaleMat = scaleMatrix(1.0, meshHeight, 1.0);
	modelMatrix = multiplyMatrices(modelMatrix, scaleMat);

	//Define rotation matrices to apply to the viewMatrix
	var rotZMat = rotateXMatrix(rotXVal);
	var rotYMat = rotateYMatrix(rotYVal);

	var eyeToTarget = subtract(target, eye);
	var viewMatrix = setupViewMatrix(eye, target);

	//zooming matrix to "Zoom" the camera into the field
	var zoomMatrix = translateMatrix(0, zoomVal, zoomVal);

	viewMatrix = multiplyMatrices(viewMatrix, zoomMatrix);

	//Order to "split" the camera transformations
	//TRANSLATE - Panning the camera (within X and Z Coordinates)
	viewMatrix = multiplyMatrices(viewMatrix, translateMatrix(panXVal, 0, panZVal));

	//ROTATE - Rotating the camera (Simulating object rotation in this instance)
	viewMatrix = multiplyMatrices(viewMatrix, rotYMat);
	viewMatrix = multiplyMatrices(viewMatrix, rotZMat);

	// model-view Matrix = view * model
	var modelviewMatrix = multiplyMatrices(viewMatrix, modelMatrix);



	// enable depth testing
	gl.enable(gl.DEPTH_TEST);

	// disable face culling to render both sides of the triangles
	gl.disable(gl.CULL_FACE);

	gl.clearColor(0.2, 0.2, 0.2, 1);
	gl.clear(gl.COLOR_BUFFER_BIT);

	gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
	gl.useProgram(program);
	
	// update modelview and projection matrices to GPU as uniforms
	gl.uniformMatrix4fv(uniformModelViewLoc, false, new Float32Array(modelviewMatrix));
	gl.uniformMatrix4fv(uniformProjectionLoc, false, new Float32Array(projectionMatrix));
	
	var primitiveType = useWire ? gl.LINES : gl.TRIANGLES;
	
	if(useWire){
		gl.bindVertexArray(vao_W);
        gl.drawArrays(primitiveType, 0, vertexCount_W);
	}else{
		gl.bindVertexArray(vao_S);
		gl.drawArrays(primitiveType, 0, vertexCount_S);
	}

	requestAnimationFrame(draw);

}

function createBox()
{
	function transformTriangle(triangle, matrix) {
		var v1 = [triangle[0], triangle[1], triangle[2], 1];
		var v2 = [triangle[3], triangle[4], triangle[5], 1];
		var v3 = [triangle[6], triangle[7], triangle[8], 1];

		var newV1 = multiplyMatrixVector(matrix, v1);
		var newV2 = multiplyMatrixVector(matrix, v2);
		var newV3 = multiplyMatrixVector(matrix, v3);

		return [
			newV1[0], newV1[1], newV1[2],
			newV2[0], newV2[1], newV2[2],
			newV3[0], newV3[1], newV3[2]
		];
	}

	var box = [];

	var triangle1 = [
		-1, -1, +1,
		-1, +1, +1,
		+1, -1, +1,
	];
	box.push(...triangle1)

	var triangle2 = [
		+1, -1, +1,
		-1, +1, +1,
		+1, +1, +1
	];
	box.push(...triangle2);

	// 3 rotations of the above face
	for (var i=1; i<=3; i++) 
	{
		var yAngle = i* (90* Math.PI / 180);
		var yRotMat = rotateYMatrix(yAngle);

		var newT1 = transformTriangle(triangle1, yRotMat);
		var newT2 = transformTriangle(triangle2, yRotMat);

		box.push(...newT1);
		box.push(...newT2);
	}

	// a rotation to provide the base of the box
	var xRotMat = rotateXMatrix(90 * Math.PI / 180);
	box.push(...transformTriangle(triangle1, xRotMat));
	box.push(...transformTriangle(triangle2, xRotMat));


	return {
		positions: box
	};

}

var isDragging = false;
var startX, startY;
var leftMouse = false;
var zoomVal = 1;

function addMouseCallback(canvas)
{
	isDragging = false;

	canvas.addEventListener("mousedown", function (e) 
	{
		if (e.button === 0) {
			console.log("Left button pressed");
			leftMouse = true;
		} else if (e.button === 2) {
			console.log("Right button pressed");
			leftMouse = false;
		}

		isDragging = true;
		startX = e.offsetX;
		startY = e.offsetY;
	});

	canvas.addEventListener("contextmenu", function(e)  {
		e.preventDefault(); // disables the default right-click menu
	});


	canvas.addEventListener("wheel", function(e)  {
		e.preventDefault(); // prevents page scroll

		zoomVal += e.deltaY * 0.001;

	});

	document.addEventListener("mousemove", function (e) {
		if (!isDragging) return;
		var currentX = e.offsetX;
		var currentY = e.offsetY;

		var deltaX = currentX - startX;
		var deltaY = currentY - startY;
		console.log('mouse drag by: ' + deltaX + ', ' + deltaY);
		const sensitivity = 0.01;

		// implement dragging logic
		if(leftMouse){
			rotYVal = deltaX * sensitivity;
			rotXVal = deltaY * sensitivity;
		}
		else{
			panXVal = deltaX * sensitivity;
			panZVal = deltaY * sensitivity;
		}
	});

	document.addEventListener("mouseup", function () {
		isDragging = false;
	});

	document.addEventListener("mouseleave", () => {
		isDragging = false;
	});
}

function initialize() 
{
	document.getElementById('checkbox').addEventListener('change', function (){window.checkBox()})
	var canvas = document.querySelector("#glcanvas");
	canvas.width = canvas.clientWidth;
	canvas.height = canvas.clientHeight;

	gl = canvas.getContext("webgl2");

	// add mouse callbacks
	addMouseCallback(canvas);

	var box = createBox();
	vertexCount_S = box.positions.length / 3;		// vertexCount is global variable used by draw()
	console.log(box);

	// create buffers to put in box
	var boxVertices = new Float32Array(box['positions']);
	var posBuffer = createBuffer(gl, gl.ARRAY_BUFFER, boxVertices);

	var vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSrc);
	var fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSrc);
	program = createProgram(gl, vertexShader, fragmentShader);

	// attributes (per vertex)
	var posAttribLoc = gl.getAttribLocation(program, "position");

	// uniforms
	uniformModelViewLoc = gl.getUniformLocation(program, 'modelview');
	uniformProjectionLoc = gl.getUniformLocation(program, 'projection');

	vao_S = createVAO(gl, 
		// positions
		posAttribLoc, posBuffer, 

		// normals (unused in this assignments)
		null, null, 

		// colors (not needed--computed by shader)
		null, null
	);

	window.requestAnimationFrame(draw);
}

window.onload = initialize();