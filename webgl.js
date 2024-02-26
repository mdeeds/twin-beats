getBody = async function(url) {
    const response = await fetch(url);
    return await response.text();
}

loadAndCompilePrograms = async function(gl) {
    // Vertex Shader
    const vertexShaderSource = await getBody('vertex-shader.glsl');
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, vertexShaderSource);
    gl.compileShader(vertexShader);
    // Check for compilation errors
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
        console.error('Error compiling vertex shader:', gl.getShaderInfoLog(vertexShader));
        return;
    }

    // Fragment Shader
    const fragmentShaderSource = (
        await getBody('util.glsl') + await getBody('fragment-shader.glsl'));
    // Create and compile the fragment shader
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, fragmentShaderSource);
    gl.compileShader(fragmentShader);
    // Check for compilation errors
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
        console.error('Error compiling fragment shader:', gl.getShaderInfoLog(fragmentShader));
        return;
    }
    
    // Create the shader program
    const program = gl.createProgram();
    gl.attachShader(program, fragmentShader);
    gl.attachShader(program, vertexShader);
    gl.linkProgram(program);
    
    // Check for linking errors
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Error linking shader program:', gl.getProgramInfoLog(program));
        return;
    }
    return program;
}

setUpGeometry = async function(gl, program) {
    // Quad for rendering
    const vertices = new Float32Array([
        -1, -1,
        1, -1,
        1, 1,
        -1, 1,
    ]);
    
    // Create a vertex buffer object (VBO)
    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    // Set attribute pointer for vertex positions
    const positionLocation = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    
    // Set viewport and clear color
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);

    // Use the program and draw the quad
    gl.useProgram(program);
    const widthLocation = gl.getUniformLocation(program, 'u_canvasWidth');
    const heightLocation = gl.getUniformLocation(program, 'u_canvasHeight');
    gl.uniform1f(widthLocation, gl.canvas.width);
    gl.uniform1f(heightLocation, gl.canvas.height);
}

class Circles {
    constructor() {
        this.flatData = [];
        this.numCircles = 0;
    }

    add(x, y, r) {
        this.flatData.push(x, y, r, 0);
        return ++this.numCircles;
    }

    move(i, dx, dy) {
        this.flatData[i * 4] += dx;
        this.flatData[i * 4 + 1] += dy;
    }

    // Returns true if x,y intersects circle i.
    _checkCollision(i, x, y) {
        const dx = x - this.flatData[i * 4];
        const dy = y - this.flatData[i * 4 + 1];
        const r = this.flatData[i * 4 + 2];
        return (r * r) > (dx * dx + dy * dy);
    }
    
    handleMouse(event) {
        if (event.type == 'mousedown') {
            console.log('down');
            const rect = event.target.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = rect.bottom - event.clientY;
            for (let i = 0; i < this.numCircles; ++i) {
                if (this._checkCollision(i, x, y)) {
                    console.log(`Clicked on ${i}`);
                }
            }
        } else if (event.type == 'mouseup') {
            console.log('up');
        }
    }
}


go = async function() {
    const canvas = document.getElementById('myCanvas');
    const gl = canvas.getContext('webgl');    
    const program = await loadAndCompilePrograms(gl);
    if (!program) return;

    await setUpGeometry(gl, program);
    
    const bubbleLocations = gl.getUniformLocation(program, 'u_bubbleLocations');
    const circles = new Circles();
    circles.add(300, 300, 50);
    circles.add(500, 300, 40);
    canvas.addEventListener('mousedown', (event) => circles.handleMouse(event));
    canvas.addEventListener('mousemove', (event) => circles.handleMouse(event));
    canvas.addEventListener('mouseup', (event) => circles.handleMouse(event));

    renderLoop = () => {
        circles.move(0, 0.5, 0);
        circles.move(1, -0.1, 0.1);
        gl.uniform4fv(bubbleLocations, circles.flatData);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
        requestAnimationFrame(renderLoop);
    }
    renderLoop();
}