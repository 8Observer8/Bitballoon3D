import { gl, initializeGL, initShaders } from "./webgl";
import { OBJDoc, DrawingInfo } from "./objparser";
import { mat4, vec3 } from "gl-matrix";
import * as $ from "jquery";

let g_playerObjDoc: OBJDoc;
let g_playerDrawingInfo: DrawingInfo;

let g_cubeObjDoc: OBJDoc;
let g_cubeDrawingInfo: DrawingInfo;

let g_platformObjDoc: OBJDoc;
let g_platformDrawingInfo: DrawingInfo;

let g_tree1ObjDoc: OBJDoc;
let g_tree1DrawingInfo: DrawingInfo;

let g_tree2ObjDoc: OBJDoc;
let g_tree2DrawingInfo: DrawingInfo;

let g_supportObjDoc: OBJDoc;
let g_supportDrawingInfo: DrawingInfo;

let g_bulletObjDoc: OBJDoc;
let g_bulletDrawingInfo: DrawingInfo;

class Color
{
    constructor(
        public r: number = 0.0,
        public g: number = 0.0,
        public b: number = 0.0,
        public a: number = 1.0)
    { }
}

export default class Game
{
    private _currentBackgroundColor: Color;
    private _colors: Color[] = [
        new Color(0.3333, 1, 0.9961, 1), // '#55FFFE'
        new Color(0.4196, 1, 0.4078, 1), // '#6BFF68'
        new Color(0.8510, 1, 0.4078, 1), // '#D9FF68'
        new Color(1, 0.6314, 0.2078, 1), // '#FFA135'
        new Color(0.7412, 0.2549, 1, 1), // '#BD41FF'
        new Color(1, 0.5255, 0.5255, 1)  // '#FF8686'
    ]
    private _program: WebGLProgram;
    private _modelMatrix: mat4;
    private _viewMatrix: mat4;
    private _modelViewMatrix: mat4;
    private _projMatrix: mat4;
    private _mvpMatrix: mat4;
    private _normalMatrix: mat4;
    private _attrs: Attributes;

    private _gameCanvas: HTMLCanvasElement;
    private _guiCanvas: HTMLCanvasElement;
    private _guiContext: CanvasRenderingContext2D;

    private _playerModel: Model;
    private _cubeModel: Model;
    private _platformModel: Model;
    private _tree1Model: Model;
    private _tree2Model: Model;
    private _supportModel: Model;
    private _bulletModel: Model;

    private _keys: boolean[] = [];

    private _bullets: { x: number, y: number, z: number }[] = [];

    private _lose: HTMLAudioElement;
    private _shoot: HTMLAudioElement;
    private _win: HTMLAudioElement;
    private _song: HTMLAudioElement;

    private _unmute: HTMLImageElement;
    private _mute: HTMLImageElement;

    private _score: number = 0;
    private _highscore: number;
    private _bulletAmountInitValue: number = 20;
    private _bulletAmount: number;
    private _drawstart: boolean;
    private _muted: boolean = false;
    private _drawbox = false;
    private _render = true;
    private _player: { x: number, y: number, z: number };
    private _playerInitPos: { x: number, y: number, z: number } = { x: 3.76, y: 1.60, z: -0.64 };

    private _randomHoleX: number;

    public constructor(gameCanvasName: string, guiCanvasName: string)
    {
        this._currentBackgroundColor = this._colors[0];
        this._player = this._playerInitPos;
        this._bulletAmount = this._bulletAmountInitValue;

        this._gameCanvas = document.getElementById(gameCanvasName) as HTMLCanvasElement;
        if (this._gameCanvas == null)
        {
            console.log(`Failed to retrieve the canvas element "${gameCanvasName}"`);
            return;
        }

        if (!initializeGL(this._gameCanvas))
        {
            return;
        }

        // Get shader elements
        var vShaderElement = document.getElementById("VertexShader");
        var fShaderElement = document.getElementById("FragmentShader");
        if (vShaderElement == null)
        {
            console.log("Failed to the vertex shader element")
            return;
        }
        if (fShaderElement == null)
        {
            console.log("Failed to the fragment shader element")
            return;
        }

        // Get shader sources
        var vShaderSource = vShaderElement.firstChild.textContent;
        var fShaderSource = fShaderElement.firstChild.textContent;

        // Initialize shaders
        this._program = initShaders(gl, vShaderSource, fShaderSource);
        if (!this._program)
        {
            console.log('Failed to intialize shaders.');
            return;
        }

        this._attrs = new Attributes();
        this._attrs.a_Position = gl.getAttribLocation(this._program, 'a_Position');
        this._attrs.a_Normal = gl.getAttribLocation(this._program, 'a_Normal');
        this._attrs.a_Color = gl.getAttribLocation(this._program, 'a_Color');
        this._attrs.u_MvpMatrix = gl.getUniformLocation(this._program, 'u_MvpMatrix');
        this._attrs.u_NormalMatrix = gl.getUniformLocation(this._program, 'u_NormalMatrix');

        if (this._attrs.a_Position < 0 || this._attrs.a_Normal < 0 || this._attrs.a_Color < 0 ||
            !this._attrs.u_MvpMatrix || !this._attrs.u_NormalMatrix)
        {
            console.log('Failed to get the location of the attribute or the uniform variable');
            return;
        }

        // Prepare empty buffer objects for vertex coordinates, colors, and normals
        this._playerModel = this.initVertexBuffers(this._program, this._attrs);
        if (!this._playerModel)
        {
            console.log('Failed to set the vertex information for playerModel');
            return;
        }

        this._cubeModel = this.initVertexBuffers(this._program, this._attrs);
        if (!this._cubeModel)
        {
            console.log('Failed to set the vertex information for cubeModel');
            return;
        }

        this._platformModel = this.initVertexBuffers(this._program, this._attrs);
        if (!this._platformModel)
        {
            console.log('Failed to set the vertex information for platformModel');
            return;
        }

        this._tree1Model = this.initVertexBuffers(this._program, this._attrs);
        if (!this._tree1Model)
        {
            console.log('Failed to set the vertex information  for tree1Model');
            return;
        }

        this._tree2Model = this.initVertexBuffers(this._program, this._attrs);
        if (!this._tree2Model)
        {
            console.log('Failed to set the vertex information for tree2Model');
            return;
        }

        this._supportModel = this.initVertexBuffers(this._program, this._attrs);
        if (!this._supportModel)
        {
            console.log('Failed to set the vertex information for supportModel');
            return;
        }

        this._bulletModel = this.initVertexBuffers(this._program, this._attrs);
        if (!this._bulletModel)
        {
            console.log('Failed to set the vertex information for bulletModel');
            return;
        }

        gl.enable(gl.DEPTH_TEST);

        gl.clearColor(this._currentBackgroundColor.r, this._currentBackgroundColor.g, this._currentBackgroundColor.b, this._currentBackgroundColor.a);

        this._mvpMatrix = mat4.create();
        this._modelMatrix = mat4.create();
        this._viewMatrix = mat4.create();
        this._projMatrix = mat4.create();
        this._normalMatrix = mat4.create();
        this._modelViewMatrix = mat4.create();

        mat4.lookAt(this._viewMatrix, [4.08, 2.8, 7], [4.08, 2.8, 0], [0, 1, 0]);
        mat4.perspective(this._projMatrix, Math.PI / 4.0, this._gameCanvas.width / this._gameCanvas.height, 0.1, 100);

        // Start reading the OBJ file
        readOBJFile("player.obj", this._playerModel, 1, false);
        //readOBJFile("cube.obj", this._cubeModel, 1, false);
        readOBJFile("platform.obj", this._platformModel, 1, false);
        readOBJFile("tree1.obj", this._tree1Model, 1, false);
        readOBJFile("tree2.obj", this._tree2Model, 1, false);
        readOBJFile("support.obj", this._supportModel, 1, false);
        readOBJFile("arrow.obj", this._bulletModel, 1, false);

        this._unmute = new Image();
        this._unmute.src = "nonmute.png";
        this._mute = new Image();
        this._mute.src = "mute.png";

        // Sounds
        this._lose = new Audio();
        this._lose.src = "lose.wav";
        this._shoot = new Audio();
        this._shoot.src = "shoot.wav";
        this._win = new Audio();
        this._win.src = "win.wav";
        this._song = new Audio();
        this._song.src = "song.mp3";

        $(document).keydown((e) =>
        {
            console.log("$(document).keydown " + e.keyCode);
            this._keys[e.keyCode ? e.keyCode : e.which] = true;
        });

        $(document).keyup((e) =>
        {
            console.log("$(document).keyup");
            delete this._keys[e.keyCode ? e.keyCode : e.which];
        });

        this.InitGUI(guiCanvasName);

        //this._guiContext.fillStyle = "white";
        //this._guiContext.fillRect(0, 0, this._guiContext.canvas.width, this._guiContext.canvas.height);
        //this._guiContext.clearRect(0, 0, this._guiContext.canvas.width, this._guiContext.canvas.height);

        this.Loop();
        this._drawstart = true;

        if (localStorage.getItem('thehighscore'))
        {
            this._highscore = parseInt(localStorage.getItem('thehighscore'));
        } else
        {
            this._highscore = 0;
        }

        this._song.loop = true;
        this._song.play();
    }

    InitGUI(guiCanvasName: string)
    {
        // GUI
        this._guiCanvas = document.getElementById(guiCanvasName) as HTMLCanvasElement;
        if (this._guiCanvas == null)
        {
            console.log(`Failed to retrieve the canvas element "${guiCanvasName}"`);
            return;
        }
        this._guiContext = this._guiCanvas.getContext("2d");
        this._guiCanvas.addEventListener("click", (event: MouseEvent) =>
        {
            let mouseX = event.clientX - this._guiContext.canvas.offsetLeft;
            let mouseY = event.clientY - this._guiContext.canvas.offsetTop;

            if (this._drawbox == true)
            {
                if (mouseX > 300 &&
                    mouseX < 500 &&
                    mouseY > 320 &&
                    mouseY < 370)
                {
                    this.Restart();
                }
            }
            if (this._drawstart == true)
            {
                if (mouseX > 300 &&
                    mouseX < 500 &&
                    mouseY > 200 &&
                    mouseY < 370)
                {
                    this.Start();
                    this._drawstart = false;
                }
            }
            if (mouseX > 752 && mouseX < 784 && mouseY > 32 && mouseY < 64)
            {
                if (this._muted == false)
                {
                    // ToDo: Offset of muted image
                    this._muted = true;
                    if (this._song.duration > 0 && !this._song.paused)
                    {
                        this._song.pause()
                    }
                }
                else if (this._muted == true)
                {
                    this._muted = false;
                    this._song.play();
                }
            }
        });
    }

    Loop()
    {
        window.setTimeout(() => { this.Loop(); }, 1000 / 60);

        for (let i in this._bullets)
        {
            var bulletp = this._bullets[i];
            bulletp.y -= 0.04;
        }

        if (this._score >= 10)
        {
            this._currentBackgroundColor = this._colors[1];
        }

        if (this._score >= 20)
        {
            this._currentBackgroundColor = this._colors[2];
        }

        if (this._score >= 30)
        {
            this._currentBackgroundColor = this._colors[3];
        }

        if (this._score >= 40)
        {
            this._currentBackgroundColor = this._colors[4];
        }

        if (this._score >= 50)
        {
            this._currentBackgroundColor = this._colors[5];
        }

        this.Controls();
        this.Draw();
    }

    Start()
    {
        this.AddBullet(this._bulletAmount);
        if (this._muted == false)
        {
            this._shoot.play();
        }
    }

    Controls()
    {
        if (this._drawstart == false)
        {
            if (this._keys[39] || this._keys[68])				
            {
                if (this._player.x < 7.02) { this._player.x += 0.04; }
            }
            if (this._keys[37] || this._keys[65])
            {
                if (this._player.x > 0.50) { this._player.x -= 0.04; }
            }
        }
    }

    Draw()
    {
        if (this._render == true)
        {
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);  // Clear color and depth buffers
            this.SetBackgroundColor(this._currentBackgroundColor);
            this._guiContext.clearRect(0, 0, this._guiCanvas.width, this._guiCanvas.height);
            this.InitDraw();

            for (let i in this._bullets)
            {
                var bullet = this._bullets[i];
                //this._guiContext.drawImage(this._bulletsprite, bullet.x, bullet.y);
                this.DrawBullet(bullet.x, bullet.y, bullet.z);
                if (bullet.y < 1.28)
                {
                    this._bullets.splice(parseInt(i), this._bullets.length);
                    this.AddBullet(this._bulletAmount);
                    this._score++;
                    if ((this._score % 10) / 10 == 0)
                    {
                        if (this._muted == false)
                        {
                            this._win.play();
                        }
                        this._bulletAmount += 2;
                    }
                }
                if (bullet.x < this._player.x + 0.64 &&
                    bullet.x + 0.09 > this._player.x &&
                    bullet.y > this._player.y - 0.64 &&
                    bullet.y - 0.32 < this._player.y)
                {
                    this.Deadass();
                }
                if (bullet.x > this._randomHoleX && bullet.x < this._randomHoleX + 0.80)
                {
                    this._bullets.splice(parseInt(i), 1);
                }
            }

            this.DrawSupport(1.00, 0.48, -0.4);
            this.DrawSupport(7.00, 0.48, -0.4);
            this.DrawSupport(3.96, 0.48, -0.4);
            this.DrawSupport(1.00, 0, -0.4);
            this.DrawSupport(7.00, 0, -0.4);
            this.DrawSupport(3.96, 0, -0.4);

            this.DrawPlayer(this._player.x, this._player.y, this._player.z);

            this._guiContext.fillStyle = 'black';
            this._guiContext.font = "30px Arial";
            this._guiContext.fillText("Score: " + this._score, 30, 50);
            this._guiContext.fillStyle = 'black';
            this._guiContext.font = "30px Arial";
            this._guiContext.fillText("Highscore: " + this._highscore, 30, 75);
        }

        if (this._drawstart == true)
        {
            if (this._keys[13] || this._keys[32])
            {
                this.Start();
                this._drawstart = false;
            }
            this._guiContext.fillStyle = 'white';
            this._guiContext.fillRect(300, 250, 200, 75);
            this._guiContext.fillStyle = 'black';
            this._guiContext.font = "50px Arial";
            this._guiContext.fillText("start", 350, 305);
        }

        if (this._drawbox == true)			
        {
            if (this._keys[13] || this._keys[32])				
            {
                this.Restart();
            }
            this._guiContext.fillStyle = 'white';
            this._guiContext.fillRect(300, 320, 200, 50);
            this._guiContext.fillStyle = 'black';
            this._guiContext.font = "40px Arial";
            this._guiContext.fillText("restart", 343, 357);
        }

        if (this._muted == false)			
        {
            this._guiContext.drawImage(this._unmute, 752, 32);
        } else
        {
            this._guiContext.drawImage(this._mute, 752, 32);
        }
    }

    SetBackgroundColor(color: Color)
    {
        gl.clearColor(color.r, color.g, color.b, color.a);
    }

    Deadass()
    {
        if (this._muted == false)
        {
            this._lose.play();
        }
        if (this._score >= this._highscore)
        {
            this._highscore = this._score;
            localStorage.setItem('thehighscore', this._highscore.toString());
        }
        this._guiContext.fillStyle = "black";
        this._render = false;
        this._guiContext.font = "60px Arial";
        this._guiContext.fillText("You died at " + this._score, 230, this._guiCanvas.height / 2);
        this._drawbox = true;
    }

    AddBullet(num: number)
    {
        if (this._muted == false)
        {
            this._shoot.play();
        }
        for (let i = 0; i < num; i++)
        {
            this._bullets.push({
                x: (Math.random() * (7.48 - 0.48) + 0.48),
                y: 7,
                z: -0.64
            });
            //randomcheck.x = (Math.floor(Math.random() * 700) + 48);
        }
        this._randomHoleX = Math.random() * (7.48 - 0.48) + 0.48;
    }

    Restart()
    {
        //this._player.x = 376; this._player.y = 440;
        this._player = this._playerInitPos;
        // for (let i in this._bullets)
        // {
        //     let bullet = this._bullets[i];
        //     //this._bullets.splice(bullet, this._bullets.length);
        // }
        this._bullets.splice(0, this._bullets.length);
        //bulletamount = 20;
        this._bulletAmount = this._bulletAmountInitValue;
        this.AddBullet(this._bulletAmount);
        this._score = 0;
        this._render = true;
        this._drawbox = false;
        this._currentBackgroundColor = this._colors[0];
    }

    InitDraw()
    {
        // Platforms
        for (let i = 0, x = 0.48; i < 15; x += 0.48, i++)
        {
            this.DrawPlatform(x, 0.96, -2);
        }

        // Trees
        let y = 2.24;
        this.DrawTree2(0.20, y, -1.4);
        this.DrawTree2(0.75, y, -2.5);
        this.DrawTree1(1.00, y, -1.7);
        this.DrawTree2(1.20, y, -2.3);
        this.DrawTree2(2.00, y, -1.5);
        this.DrawTree1(3.00, y, -2.6);
        this.DrawTree2(3.20, y, -2);
        this.DrawTree2(4.00, y, -2.3);
        this.DrawTree1(5.00, y, -2.5);
        this.DrawTree2(6.00, y, -2);
        this.DrawTree1(6.75, y, -1.5);
    }

    DrawPlayer(x: number, y: number, z: number)
    {
        if (g_playerObjDoc != null && g_playerObjDoc.IsMTLComplete()) // OBJ and all MTLs are available
        {
            g_playerDrawingInfo = this.onReadComplete(gl, this._playerModel, g_playerObjDoc);
            g_playerObjDoc = null;
        }
        if (!g_playerDrawingInfo) return;   // It reads the model already or judgment

        this.initAttributeVariable(this._attrs.a_Position, 3, this._playerModel.vertexBuffer);
        this.initAttributeVariable(this._attrs.a_Color, 4, this._playerModel.colorBuffer);
        this.initAttributeVariable(this._attrs.a_Normal, 3, this._playerModel.normalBuffer);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._playerModel.indexBuffer);

        mat4.identity(this._modelMatrix);
        mat4.translate(this._modelMatrix, this._modelMatrix, [x, y, z]);
        mat4.multiply(this._modelViewMatrix, this._viewMatrix, this._modelMatrix);
        mat4.multiply(this._mvpMatrix, this._projMatrix, this._modelViewMatrix);

        // g_modelMatrix.setRotate(angle, 1.0, 0.0, 0.0); // Tr: Suitably rotation
        // g_modelMatrix.rotate(angle, 0.0, 1.0, 0.0);
        // g_modelMatrix.rotate(angle, 0.0, 0.0, 1.0);

        // Calculate the normal transformation matrix and pass it to u_NormalMatrix
        //this._normalMatrix.setInverseOf(this._modelMatrix);
        //this._normalMatrix.transpose();
        mat4.invert(this._normalMatrix, this._modelMatrix);
        mat4.transpose(this._normalMatrix, this._normalMatrix);
        gl.uniformMatrix4fv(this._attrs.u_NormalMatrix, false, this._normalMatrix);

        // Calculate the model view project matrix and pass it to u_MvpMatrix
        // g_mvpMatrix.set(viewProjMatrix);
        // g_mvpMatrix.multiply(g_modelMatrix);
        gl.uniformMatrix4fv(this._attrs.u_MvpMatrix, false, this._mvpMatrix);

        // Draw
        gl.drawElements(gl.TRIANGLES, g_playerDrawingInfo.indices.length, gl.UNSIGNED_SHORT, 0);
    }

    DrawCube()
    {
        if (g_cubeObjDoc != null && g_cubeObjDoc.IsMTLComplete()) // OBJ and all MTLs are available
        {
            g_cubeDrawingInfo = this.onReadComplete(gl, this._cubeModel, g_cubeObjDoc);
            g_cubeObjDoc = null;
        }
        if (!g_cubeDrawingInfo) return;   // Tr: It reads the model already or judgment

        this.initAttributeVariable(this._attrs.a_Position, 3, this._cubeModel.vertexBuffer);
        this.initAttributeVariable(this._attrs.a_Color, 4, this._cubeModel.colorBuffer);
        this.initAttributeVariable(this._attrs.a_Normal, 3, this._cubeModel.normalBuffer);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._cubeModel.indexBuffer);

        mat4.identity(this._modelMatrix);
        mat4.translate(this._modelMatrix, this._modelMatrix, [-2, 0, 0]);
        mat4.multiply(this._modelViewMatrix, this._viewMatrix, this._modelMatrix);
        mat4.multiply(this._mvpMatrix, this._projMatrix, this._modelViewMatrix);

        // g_modelMatrix.setRotate(angle, 1.0, 0.0, 0.0); // Tr: Suitably rotation
        // g_modelMatrix.rotate(angle, 0.0, 1.0, 0.0);
        // g_modelMatrix.rotate(angle, 0.0, 0.0, 1.0);

        // Calculate the normal transformation matrix and pass it to u_NormalMatrix
        //this._normalMatrix.setInverseOf(this._modelMatrix);
        //this._normalMatrix.transpose();
        mat4.invert(this._normalMatrix, this._modelMatrix);
        mat4.transpose(this._normalMatrix, this._normalMatrix);
        gl.uniformMatrix4fv(this._attrs.u_NormalMatrix, false, this._normalMatrix);

        // Calculate the model view project matrix and pass it to u_MvpMatrix
        // g_mvpMatrix.set(viewProjMatrix);
        // g_mvpMatrix.multiply(g_modelMatrix);
        gl.uniformMatrix4fv(this._attrs.u_MvpMatrix, false, this._mvpMatrix);

        // Draw
        gl.drawElements(gl.TRIANGLES, g_cubeDrawingInfo.indices.length, gl.UNSIGNED_SHORT, 0);
    }

    DrawPlatform(x: number, y: number, z: number)
    {
        if (g_platformObjDoc != null && g_platformObjDoc.IsMTLComplete()) // OBJ and all MTLs are available
        {
            g_platformDrawingInfo = this.onReadComplete(gl, this._platformModel, g_platformObjDoc);
            g_platformObjDoc = null;
        }
        if (!g_platformDrawingInfo) return;   // Tr: It reads the model already or judgment

        this.initAttributeVariable(this._attrs.a_Position, 3, this._platformModel.vertexBuffer);
        this.initAttributeVariable(this._attrs.a_Color, 4, this._platformModel.colorBuffer);
        this.initAttributeVariable(this._attrs.a_Normal, 3, this._platformModel.normalBuffer);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._platformModel.indexBuffer);

        mat4.identity(this._modelMatrix);
        mat4.translate(this._modelMatrix, this._modelMatrix, [x, y, z]);
        mat4.multiply(this._modelViewMatrix, this._viewMatrix, this._modelMatrix);
        mat4.multiply(this._mvpMatrix, this._projMatrix, this._modelViewMatrix);

        // Calculate the normal transformation matrix and pass it to u_NormalMatrix
        mat4.invert(this._normalMatrix, this._modelMatrix);
        mat4.transpose(this._normalMatrix, this._normalMatrix);
        gl.uniformMatrix4fv(this._attrs.u_NormalMatrix, false, this._normalMatrix);

        // Calculate the model view project matrix and pass it to u_MvpMatrix
        gl.uniformMatrix4fv(this._attrs.u_MvpMatrix, false, this._mvpMatrix);

        // Draw
        gl.drawElements(gl.TRIANGLES, g_platformDrawingInfo.indices.length, gl.UNSIGNED_SHORT, 0);
    }

    DrawTree1(x: number, y: number, z: number)
    {
        if (g_tree1ObjDoc != null && g_tree1ObjDoc.IsMTLComplete()) // OBJ and all MTLs are available
        {
            g_tree1DrawingInfo = this.onReadComplete(gl, this._tree1Model, g_tree1ObjDoc);
            g_tree1ObjDoc = null;
        }
        if (!g_tree1DrawingInfo) return;   // Tr: It reads the model already or judgment

        this.initAttributeVariable(this._attrs.a_Position, 3, this._tree1Model.vertexBuffer);
        this.initAttributeVariable(this._attrs.a_Color, 4, this._tree1Model.colorBuffer);
        this.initAttributeVariable(this._attrs.a_Normal, 3, this._tree1Model.normalBuffer);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._tree1Model.indexBuffer);

        mat4.identity(this._modelMatrix);
        mat4.translate(this._modelMatrix, this._modelMatrix, [x, y, z]);
        mat4.multiply(this._modelViewMatrix, this._viewMatrix, this._modelMatrix);
        mat4.multiply(this._mvpMatrix, this._projMatrix, this._modelViewMatrix);

        // Calculate the normal transformation matrix and pass it to u_NormalMatrix
        mat4.invert(this._normalMatrix, this._modelMatrix);
        mat4.transpose(this._normalMatrix, this._normalMatrix);
        gl.uniformMatrix4fv(this._attrs.u_NormalMatrix, false, this._normalMatrix);

        // Calculate the model view project matrix and pass it to u_MvpMatrix
        gl.uniformMatrix4fv(this._attrs.u_MvpMatrix, false, this._mvpMatrix);

        // Draw
        gl.drawElements(gl.TRIANGLES, g_tree1DrawingInfo.indices.length, gl.UNSIGNED_SHORT, 0);
    }

    DrawTree2(x: number, y: number, z: number)
    {
        if (g_tree2ObjDoc != null && g_tree2ObjDoc.IsMTLComplete()) // OBJ and all MTLs are available
        {
            g_tree2DrawingInfo = this.onReadComplete(gl, this._tree2Model, g_tree2ObjDoc);
            g_tree2ObjDoc = null;
        }
        if (!g_tree2DrawingInfo) return;   // Tr: It reads the model already or judgment

        this.initAttributeVariable(this._attrs.a_Position, 3, this._tree2Model.vertexBuffer);
        this.initAttributeVariable(this._attrs.a_Color, 4, this._tree2Model.colorBuffer);
        this.initAttributeVariable(this._attrs.a_Normal, 3, this._tree2Model.normalBuffer);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._tree2Model.indexBuffer);

        mat4.identity(this._modelMatrix);
        mat4.translate(this._modelMatrix, this._modelMatrix, [x, y, z]);
        mat4.multiply(this._modelViewMatrix, this._viewMatrix, this._modelMatrix);
        mat4.multiply(this._mvpMatrix, this._projMatrix, this._modelViewMatrix);

        // Calculate the normal transformation matrix and pass it to u_NormalMatrix
        mat4.invert(this._normalMatrix, this._modelMatrix);
        mat4.transpose(this._normalMatrix, this._normalMatrix);
        gl.uniformMatrix4fv(this._attrs.u_NormalMatrix, false, this._normalMatrix);

        // Calculate the model view project matrix and pass it to u_MvpMatrix
        gl.uniformMatrix4fv(this._attrs.u_MvpMatrix, false, this._mvpMatrix);

        // Draw
        gl.drawElements(gl.TRIANGLES, g_tree2DrawingInfo.indices.length, gl.UNSIGNED_SHORT, 0);
    }

    DrawSupport(x: number, y: number, z: number)
    {
        if (g_supportObjDoc != null && g_supportObjDoc.IsMTLComplete()) // OBJ and all MTLs are available
        {
            g_supportDrawingInfo = this.onReadComplete(gl, this._supportModel, g_supportObjDoc);
            g_supportObjDoc = null;
        }
        if (!g_supportDrawingInfo) return;   // Tr: It reads the model already or judgment

        this.initAttributeVariable(this._attrs.a_Position, 3, this._supportModel.vertexBuffer);
        this.initAttributeVariable(this._attrs.a_Color, 4, this._supportModel.colorBuffer);
        this.initAttributeVariable(this._attrs.a_Normal, 3, this._supportModel.normalBuffer);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._supportModel.indexBuffer);

        mat4.identity(this._modelMatrix);
        mat4.translate(this._modelMatrix, this._modelMatrix, [x, y, z]);
        mat4.multiply(this._modelViewMatrix, this._viewMatrix, this._modelMatrix);
        mat4.multiply(this._mvpMatrix, this._projMatrix, this._modelViewMatrix);

        // Calculate the normal transformation matrix and pass it to u_NormalMatrix
        mat4.invert(this._normalMatrix, this._modelMatrix);
        mat4.transpose(this._normalMatrix, this._normalMatrix);
        gl.uniformMatrix4fv(this._attrs.u_NormalMatrix, false, this._normalMatrix);

        // Calculate the model view project matrix and pass it to u_MvpMatrix
        gl.uniformMatrix4fv(this._attrs.u_MvpMatrix, false, this._mvpMatrix);

        // Draw
        gl.drawElements(gl.TRIANGLES, g_supportDrawingInfo.indices.length, gl.UNSIGNED_SHORT, 0);
    }

    DrawBullet(x: number, y: number, z: number)
    {
        if (g_bulletObjDoc != null && g_bulletObjDoc.IsMTLComplete()) // OBJ and all MTLs are available
        {
            g_bulletDrawingInfo = this.onReadComplete(gl, this._bulletModel, g_bulletObjDoc);
            g_bulletObjDoc = null;
        }
        if (!g_bulletDrawingInfo) return;   // Tr: It reads the model already or judgment

        this.initAttributeVariable(this._attrs.a_Position, 3, this._bulletModel.vertexBuffer);
        this.initAttributeVariable(this._attrs.a_Color, 4, this._bulletModel.colorBuffer);
        this.initAttributeVariable(this._attrs.a_Normal, 3, this._bulletModel.normalBuffer);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._bulletModel.indexBuffer);

        mat4.identity(this._modelMatrix);
        mat4.translate(this._modelMatrix, this._modelMatrix, [x, y, z]);
        mat4.multiply(this._modelViewMatrix, this._viewMatrix, this._modelMatrix);
        mat4.multiply(this._mvpMatrix, this._projMatrix, this._modelViewMatrix);

        // Calculate the normal transformation matrix and pass it to u_NormalMatrix
        mat4.invert(this._normalMatrix, this._modelMatrix);
        mat4.transpose(this._normalMatrix, this._normalMatrix);
        gl.uniformMatrix4fv(this._attrs.u_NormalMatrix, false, this._normalMatrix);

        // Calculate the model view project matrix and pass it to u_MvpMatrix
        gl.uniformMatrix4fv(this._attrs.u_MvpMatrix, false, this._mvpMatrix);

        // Draw
        gl.drawElements(gl.TRIANGLES, g_bulletDrawingInfo.indices.length, gl.UNSIGNED_SHORT, 0);
    }

    initAttributeVariable(a_attribute: number, num: number, buffer: WebGLBuffer)
    {
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.vertexAttribPointer(a_attribute, num, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(a_attribute);
    }

    // OBJ File has been read compreatly
    onReadComplete(gl: WebGLRenderingContext, model: Model, objDoc: OBJDoc)
    {
        // Acquire the vertex coordinates and colors from OBJ file
        var drawingInfo = objDoc.GetDrawingInfo();

        // Write date into the buffer object
        gl.bindBuffer(gl.ARRAY_BUFFER, model.vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, drawingInfo.vertices, gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, model.normalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, drawingInfo.normals, gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, model.colorBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, drawingInfo.colors, gl.STATIC_DRAW);

        // Write the indices to the buffer object
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, model.indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, drawingInfo.indices, gl.STATIC_DRAW);

        // Unbind the buffer object
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

        return drawingInfo;
    }

    // Create an buffer object and perform an initial configuration
    initVertexBuffers(program: WebGLProgram, attrs: Attributes)
    {
        var o = new Model(); // Utilize Object object to return multiple buffer objects
        o.vertexBuffer = this.createEmptyArrayBuffer();//(attrs.a_Position, 3, gl.FLOAT);
        o.normalBuffer = this.createEmptyArrayBuffer();//(attrs.a_Normal, 3, gl.FLOAT);
        o.colorBuffer = this.createEmptyArrayBuffer();//(attrs.a_Color, 4, gl.FLOAT);
        o.indexBuffer = gl.createBuffer();
        if (!o.vertexBuffer || !o.normalBuffer || !o.colorBuffer || !o.indexBuffer)
        {
            return null;
        }

        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        return o;
    }

    // Create a buffer object, assign it to attribute variables, and enable the assignment
    createEmptyArrayBuffer(
        /*a_attribute: number,
        num: number,
        type: number*/): WebGLBuffer
    {
        let buffer = gl.createBuffer();

        if (!buffer)
        {
            console.log('Failed to create the buffer object');
            return null;
        }
        //gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        //gl.vertexAttribPointer(a_attribute, num, type, false, 0, 0);  // Assign the buffer object to the attribute variable
        //gl.enableVertexAttribArray(a_attribute);  // Enable the assignment

        return buffer;
    }
}

class Attributes
{
    public a_Position: number;
    public a_Normal: number;
    public a_Color: number;
    public u_MvpMatrix: WebGLUniformLocation;
    public u_NormalMatrix: WebGLUniformLocation;
}

export function readOBJFile(
    fileName: string, model: Model,
    scale: number, reverse: boolean)
{
    let request = new XMLHttpRequest();

    request.onreadystatechange = function ()
    {
        if (request.readyState === 4 && request.status !== 404)
        {
            onReadOBJFile(request.responseText, fileName, model, scale, reverse);
        }
    }
    request.open('GET', fileName, true); // Create a request to acquire the file
    request.send();                      // Send the request
}

function onReadOBJFile(
    fileString: string, fileName: string, o: Model,
    scale: number, reverse: boolean)
{
    let objDoc = new OBJDoc(fileName);  // Create a OBJDoc object
    let result = objDoc.Parse(fileString, scale, reverse); // Parse the file
    if (!result)
    {
        g_playerObjDoc = null; g_playerDrawingInfo = null;
        console.log("OBJ file parsing error.");
        return;
    }
    if (fileName == "player.obj")
    {
        g_playerObjDoc = objDoc;
    }
    else if (fileName == "cube.obj")
    {
        g_cubeObjDoc = objDoc;
    }
    else if (fileName == "platform.obj")
    {
        g_platformObjDoc = objDoc;
    }
    else if (fileName == "tree1.obj")
    {
        g_tree1ObjDoc = objDoc;
    }
    else if (fileName == "tree2.obj")
    {
        g_tree2ObjDoc = objDoc;
    }
    else if (fileName == "support.obj")
    {
        g_supportObjDoc = objDoc;
    }
    else if (fileName == "arrow.obj")
    {
        g_bulletObjDoc = objDoc;
    }
}

export class Model
{
    public vertexBuffer: WebGLBuffer;
    public normalBuffer: WebGLBuffer;
    public colorBuffer: WebGLBuffer;
    public indexBuffer: WebGLBuffer;
}