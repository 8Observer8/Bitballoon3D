export let gl: WebGLRenderingContext = null;

export function initializeGL(canvas: HTMLCanvasElement): boolean
{
    gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (gl == null)
    {
        console.log("Failed to get WebGL rendering context");
        return false;
    }

    return true;
}

/**
 * Create a program object and make current
 * @param gl GL context
 * @param vshader a vertex shader program (string)
 * @param fshader a fragment shader program (string)
 * @return true, if the program object was created and successfully made current 
 */
export function initShaders(
    gl: WebGLRenderingContext,
    vshader: string,
    fshader: string): WebGLProgram
{
    let program = createProgram(gl, vshader, fshader);
    if (!program)
    {
        console.log('Failed to create program');
        return false;
    }

    gl.useProgram(program);

    return program;
}

/**
 * Create the linked program object
 * @param gl GL context
 * @param vshader a vertex shader program (string)
 * @param fshader a fragment shader program (string)
 * @return created program object, or null if the creation has failed
 */
function createProgram(
    gl: WebGLRenderingContext,
    vshader: string,
    fshader: string)
{
    // Create shader object
    let vertexShader = loadShader(gl, gl.VERTEX_SHADER, vshader);
    let fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fshader);
    if (!vertexShader || !fragmentShader)
    {
        return null;
    }

    // Create a program object
    let program = gl.createProgram();
    if (!program)
    {
        return null;
    }

    // Attach the shader objects
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);

    // Link the program object
    gl.linkProgram(program);

    // Check the result of linking
    let linked = gl.getProgramParameter(program, gl.LINK_STATUS);
    if (!linked)
    {
        let error = gl.getProgramInfoLog(program);
        console.log('Failed to link program: ' + error);
        gl.deleteProgram(program);
        gl.deleteShader(fragmentShader);
        gl.deleteShader(vertexShader);
        return null;
    }
    return program;
}

/**
 * Create a shader object
 * @param gl GL context
 * @param type the type of the shader object to be created
 * @param source shader program (string)
 * @return created shader object, or null if the creation has failed.
 */
function loadShader(gl: WebGLRenderingContext, type: number, source: string)
{
    // Create shader object
    let shader = gl.createShader(type);
    if (shader == null)
    {
        console.log('Unable to create shader');
        return null;
    }

    // Set the shader program
    gl.shaderSource(shader, source);

    // Compile the shader
    gl.compileShader(shader);

    // Check the result of compilation
    let compiled = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    if (!compiled)
    {
        let error = gl.getShaderInfoLog(shader);
        console.log('Failed to compile shader: ' + error);
        gl.deleteShader(shader);
        return null;
    }

    return shader;
}