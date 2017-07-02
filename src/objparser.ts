import { vec3 } from "gl-matrix";

export class OBJDoc
{
    private _mtls: Array<MTLDoc> = new Array<MTLDoc>();
    private _objects: Array<OBJObject> = new Array<OBJObject>();
    private _vertices: Array<Vertex> = new Array<Vertex>();
    private _normals: Array<Normal> = new Array<Normal>();

    public constructor(private _fileName: string) { }

    // Parsing the OBJ file
    public Parse(fileString: string, scale: number, reverse: boolean)
    {
        let lines = fileString.split('\n');
        lines.push(null);
        let index = 0;

        let currentObject = null;
        let currentMaterialName = "";

        // Parse line by line
        let line;
        let sp = new StringParser();
        while ((line = lines[index++]) != null)
        {
            sp.Init(line);
            let command = sp.GetWord();
            if (command == null)
            {
                continue;
            }

            switch (command)
            {
                case "#":
                    continue; // Skip comments
                case "mtllib": // Read Material chunk
                    let path = this.ParseMtllib(sp, this._fileName);
                    let mtl = new MTLDoc();
                    this._mtls.push(mtl);
                    let request = new XMLHttpRequest();
                    request.onreadystatechange = () =>
                    {
                        if (request.readyState == 4)
                        {
                            if (request.status != 404)
                            {
                                onReadMTLFile(request.responseText, mtl);
                            }
                            else
                            {
                                mtl.complete = true;
                            }
                        }
                    }
                    request.open("GET", path, true);
                    request.send();
                    continue; // Go to the next line
                case "o":
                case "g": // Read Object name
                    let object = this.ParseObjectName(sp);
                    this._objects.push(object);
                    currentObject = object;
                    continue; // Go to the next line
                case "v": // Read vertex
                    let vertex = this.ParseVertex(sp, scale);
                    this._vertices.push(vertex);
                    continue; // Go to the next line
                case "vn": // Read normal
                    let normal = this.ParseNormal(sp);
                    this._normals.push(normal);
                    continue; // Go to the next line
                case "usemtl":
                    currentMaterialName = this.ParseUsemtl(sp);
                    continue; // Go to the next line
                case "f": // Read face
                    var face = this.ParseFace(sp, currentMaterialName, this._vertices, reverse);
                    currentObject.addFace(face);
                    continue; // Go to the next line
            }
        }

        return true;
    }

    private ParseMtllib(sp: StringParser, fileName: string)
    {
        // Get directory path
        let i = fileName.lastIndexOf("/");
        let dirPath = "";
        if (i > 0)
        {
            dirPath = fileName.substr(0, i + 1);
        }
        return dirPath + sp.GetWord();
    }

    private ParseObjectName(sp: StringParser)
    {
        let name = sp.GetWord();
        return new OBJObject(name);
    }

    private ParseVertex(sp: StringParser, scale: number)
    {
        let x = sp.GetFloat() * scale;
        let y = sp.GetFloat() * scale;
        let z = sp.GetFloat() * scale;
        return new Vertex(x, y, z);
    }

    private ParseNormal(sp: StringParser)
    {
        let x = sp.GetFloat();
        let y = sp.GetFloat();
        let z = sp.GetFloat();
        return new Normal(x, y, z);
    }

    private ParseUsemtl(sp: StringParser): string
    {
        return sp.GetWord();
    }

    private ParseFace(
        sp: StringParser, materialName: string,
        vertices: Array<Vertex>, reverse: boolean)
    {
        let face = new Face(materialName);

        // Get indices
        for (; ;)
        {
            let word = sp.GetWord();
            if (word == null)
            {
                break;
            }
            let subWords = word.split("/");
            if (subWords.length >= 1)
            {
                let vi = parseInt(subWords[0]) - 1;
                face.vIndices.push(vi);
            }
            if (subWords.length >= 3)
            {
                let ni = parseInt(subWords[2]) - 1;
                face.nIndices.push(ni);
            }
            else
            {
                face.nIndices.push(-1);
            }
        }

        // Calc normal
        let v0 = [
            vertices[face.vIndices[0]].x,
            vertices[face.vIndices[0]].y,
            vertices[face.vIndices[0]].z
        ];
        let v1 = [
            vertices[face.vIndices[1]].x,
            vertices[face.vIndices[1]].y,
            vertices[face.vIndices[1]].z
        ];
        let v2 = [
            vertices[face.vIndices[2]].x,
            vertices[face.vIndices[2]].y,
            vertices[face.vIndices[2]].z
        ];

        // Set to normal by calculating the normal line of the surface
        let normal = calcNormal(v0, v1, v2);

        // Investigate whether the normal has been obtained correctly
        if (normal == null)
        {
            if (face.vIndices.length >= 4)
            {
                // Normal calculation by a combination of another three points if the face is square
                var v3 = [
                    vertices[face.vIndices[3]].x,
                    vertices[face.vIndices[3]].y,
                    vertices[face.vIndices[3]].z];
                normal = calcNormal(v1, v2, v3);
            }
            if (normal == null)
            {
                // And the normal to the Y-axis direction because the normal is not sought
                normal = vec3.fromValues(0.0, 1.0, 0.0);
            }
        }
        if (reverse)
        {
            normal[0] = -normal[0];
            normal[1] = -normal[1];
            normal[2] = -normal[2];
        }
        face.normal = new Normal(normal[0], normal[1], normal[2]);

        // Devide to triangles if face contains over 3 points.
        if (face.vIndices.length > 3)
        {
            var n = face.vIndices.length - 2;
            var newVIndices = new Array(n * 3);
            var newNIndices = new Array(n * 3);
            for (var i = 0; i < n; i++)
            {
                newVIndices[i * 3 + 0] = face.vIndices[0];
                newVIndices[i * 3 + 1] = face.vIndices[i + 1];
                newVIndices[i * 3 + 2] = face.vIndices[i + 2];
                newNIndices[i * 3 + 0] = face.nIndices[0];
                newNIndices[i * 3 + 1] = face.nIndices[i + 1];
                newNIndices[i * 3 + 2] = face.nIndices[i + 2];
            }
            face.vIndices = newVIndices;
            face.nIndices = newNIndices;
        }
        face.numIndices = face.vIndices.length;

        return face;
    }

    // Check Materials
    public IsMTLComplete()
    {
        if (this._mtls.length == 0)
        {
            return true;
        }
        for (let i = 0; i < this._mtls.length; i++)
        {
            if (!this._mtls[i].complete)
            {
                return false;
            }
        }
        return true;
    }

    // Find color by material name
    private FindColor(materialName: string)
    {
        for (let i = 0; i < this._mtls.length; i++)
        {
            for (let j = 0; j < this._mtls[i].materials.length; j++)
            {
                if (this._mtls[i].materials[j].name == materialName)
                {
                    return this._mtls[i].materials[j].color;
                }
            }
        }
        return new Color(0.8, 0.8, 0.8, 1.0);
    }

    // Retrieve the information for drawing 3D model
    public GetDrawingInfo(): DrawingInfo
    {
        // Create an arrays for vertex coordinates, normals, colors, and indices
        let numIndices = 0;
        for (let i = 0; i < this._objects.length; i++)
        {
            numIndices += this._objects[i].numIndices;
        }
        let numVertices = numIndices;
        let vertices = new Float32Array(numVertices * 3);
        let normals = new Float32Array(numVertices * 3);
        let colors = new Float32Array(numVertices * 4);
        let indices = new Uint16Array(numIndices);

        // Set vertex, normal and color
        let index_indices = 0;
        for (let i = 0; i < this._objects.length; i++)
        {
            let object = this._objects[i];
            for (var j = 0; j < object.faces.length; j++)
            {
                var face = object.faces[j];
                var color = this.FindColor(face.materialName);
                var faceNormal = face.normal;
                for (var k = 0; k < face.vIndices.length; k++)
                {
                    // Set index
                    indices[index_indices] = index_indices;
                    // Copy vertex
                    var vIdx = face.vIndices[k];
                    var vertex = this._vertices[vIdx];
                    vertices[index_indices * 3 + 0] = vertex.x;
                    vertices[index_indices * 3 + 1] = vertex.y;
                    vertices[index_indices * 3 + 2] = vertex.z;
                    // Copy color
                    colors[index_indices * 4 + 0] = color.r;
                    colors[index_indices * 4 + 1] = color.g;
                    colors[index_indices * 4 + 2] = color.b;
                    colors[index_indices * 4 + 3] = color.a;
                    // Copy normal
                    var nIdx = face.nIndices[k];
                    if (nIdx >= 0)
                    {
                        var normal = this._normals[nIdx];
                        normals[index_indices * 3 + 0] = normal.x;
                        normals[index_indices * 3 + 1] = normal.y;
                        normals[index_indices * 3 + 2] = normal.z;
                    } else
                    {
                        normals[index_indices * 3 + 0] = faceNormal.x;
                        normals[index_indices * 3 + 1] = faceNormal.y;
                        normals[index_indices * 3 + 2] = faceNormal.z;
                    }
                    index_indices++;
                }
            }
        }
        return new DrawingInfo(vertices, normals, colors, indices);
    }
}

// Analyze the material file
function onReadMTLFile(fileString: string, mtl: MTLDoc)
{
    let lines = fileString.split('\n');  // Break up into lines and store them as array
    lines.push(null);           // Append null
    let index = 0;              // Initialize index of line

    // Parse line by line
    let line;      // A string in the line to be parsed
    let name = ""; // Material name
    let sp = new StringParser();  // Create StringParser
    while ((line = lines[index++]) != null)
    {
        sp.Init(line);                  // init StringParser
        let command = sp.GetWord();     // Get command
        if (command == null) continue;  // check null command

        switch (command)
        {
            case '#':
                continue;    // Skip comments
            case 'newmtl': // Read Material chunk
                name = mtl.ParseNewMtl(sp);    // Get name
                continue; // Go to the next line
            case 'Kd':   // Read normal
                if (name == "") continue; // Go to the next line because of Error
                var material = mtl.ParseRGB(sp, name);
                mtl.materials.push(material);
                name = "";
                continue; // Go to the next line
        }
    }
    mtl.complete = true;
}

class MTLDoc
{
    public complete: boolean = false;
    public materials: Array<Material> = new Array<Material>();

    public ParseNewMtl(sp: StringParser): string
    {
        return sp.GetWord();
    }

    public ParseRGB(sp: StringParser, name: string)
    {
        let r = sp.GetFloat();
        let g = sp.GetFloat();
        let b = sp.GetFloat();
        return (new Material(name, r, g, b, 1.0));
    }
}

class Material
{
    public color: Color;

    public constructor(
        public name: string,
        private r: number,
        private g: number,
        private b: number,
        private a: number)
    {
        this.color = new Color(r, g, b, a);
    }
}

class Vertex
{
    public constructor(
        public x: number,
        public y: number,
        public z: number)
    { }
}

class Normal
{
    public constructor(
        public x: number,
        public y: number,
        public z: number)
    { }
}

class Color
{
    public constructor(
        public r: number,
        public g: number,
        public b: number,
        public a: number)
    { }
}

class OBJObject
{
    public faces: Array<Face> = new Array<Face>();
    public numIndices: number = 0;

    public constructor(public name: string) { }

    public addFace(face: Face): void
    {
        this.faces.push(face);
        this.numIndices += face.numIndices;
    }
}

class Face
{
    public materialName: string;
    public vIndices: Array<number> = new Array<number>();
    public nIndices: Array<number> = new Array<number>();
    public numIndices: number;
    public normal: Normal;

    public constructor(materialName: string)
    {
        if (materialName != null)
        {
            this.materialName = materialName;
        }
        else
        {
            this.materialName = "";
        }
    }
}

export class DrawingInfo
{
    public constructor(
        public vertices: Float32Array,
        public normals: Float32Array,
        public colors: Float32Array,
        public indices: Uint16Array)
    { }
}

class StringParser
{
    private _str: string;
    private _index: number; // Position in the string to be processed

    public Init(str: string)
    {
        this._str = str;
        this._index = 0;
    }

    private SkipDelimiters()
    {
        let i = this._index;
        for (let len = this._str.length; i < len; i++)
        {
            let c = this._str.charAt(i);
            // Skip TAB, Space, '(', ')', '"'
            if (c == '\t' || c == ' ' || c == '(' || c == ')' || c == '"')
            {
                continue;
            }
            break;
        }
        this._index = i;
    }

    private SkipToNextWord()
    {
        this.SkipDelimiters();
        let n = getWordLength(this._str, this._index);
        this._index += (n + 1);
    }

    public GetWord(): string
    {
        this.SkipDelimiters();
        let n = getWordLength(this._str, this._index);
        if (n == 0)
        {
            return null;
        }
        let word = this._str.substr(this._index, n);
        this._index += (n + 1);
        return word;
    }

    public GetInt(): number
    {
        return parseInt(this.GetWord());
    }

    public GetFloat()
    {
        return parseFloat(this.GetWord());
    }
}

function getWordLength(str: string, start: number)
{
    let n = 0;
    let i = start;
    for (let len = str.length; i < len; i++)
    {
        let c = str.charAt(i);
        if (c == '\t' || c == ' ' || c == '(' || c == ')' || c == '"')
        {
            break;
        }
    }
    return i - start;
}

function calcNormal(
    p0: Array<number>,
    p1: Array<number>,
    p2: Array<number>): vec3
{
    // v0: a vector from p1 to p0, v1: a vector from p1 to p2
    var v0 = new Float32Array(3);
    var v1 = new Float32Array(3);
    for (var i = 0; i < 3; i++)
    {
        v0[i] = p0[i] - p1[i];
        v1[i] = p2[i] - p1[i];
    }

    // The cross product of v0 and v1
    var c = new Float32Array(3);
    c[0] = v0[1] * v1[2] - v0[2] * v1[1];
    c[1] = v0[2] * v1[0] - v0[0] * v1[2];
    c[2] = v0[0] * v1[1] - v0[1] * v1[0];

    // Normalize the result
    var v = vec3.fromValues(c[0], c[1], c[2]);
    vec3.normalize(v, v);
    return v;
}