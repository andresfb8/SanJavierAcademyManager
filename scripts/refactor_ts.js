import { Project, SyntaxKind } from 'ts-morph';
import fs from 'fs';

async function main() {
    const project = new Project();
    project.addSourceFileAtPath('src/stores/dataStore.ts');
    const sourceFile = project.getSourceFileOrThrow('src/stores/dataStore.ts');

    const collectionsToRemove = [
        'payments', 'attendance', 'activities', 'eventPayments',
        'privateLessonPayments', 'evaluations', 'matchReports', 'invoices'
    ];

    // 1. Remove properties from DataState interface
    const dataStateInterface = sourceFile.getInterfaceOrThrow('DataState');
    collectionsToRemove.forEach(col => {
        const prop = dataStateInterface.getProperty(col);
        if (prop) prop.remove();
    });

    // 2. Remove initial state values in the persist callback
    const callExprs = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
    const persistCalls = callExprs.filter(c => c.getExpression().getText() === 'persist');
    if (persistCalls.length > 0) {
        const args = persistCalls[0].getArguments();
        if (args.length > 0 && args[0].getKind() === SyntaxKind.ArrowFunction) {
            const arrowFunc = args[0];
            const body = arrowFunc.getBody();
            if (body.getKind() === SyntaxKind.ParenthesizedExpression) {
                const objLiteral = body.getExpressionIfKind(SyntaxKind.ObjectLiteralExpression);
                if (objLiteral) {
                    collectionsToRemove.forEach(col => {
                        const prop = objLiteral.getProperty(col);
                        if (prop) prop.remove();
                    });
                }
            }
        }
    }

    // 4. Find and remove `set(...)` calls inside all methods for these collections
    const allSetCalls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).filter(c => c.getExpression().getText() === 'set');
    const nodesToRemove = [];
    
    allSetCalls.forEach(setCall => {
        const args = setCall.getArguments();
        if (args.length === 0) return;
        
        let shouldRemove = false;
        const arg = args[0];
        
        let objLiteral = null;
        if (arg.getKind() === SyntaxKind.ObjectLiteralExpression) {
            objLiteral = arg;
        } else if (arg.getKind() === SyntaxKind.ArrowFunction) {
            const body = arg.getBody();
            if (body.getKind() === SyntaxKind.ParenthesizedExpression) {
                objLiteral = body.getExpressionIfKind(SyntaxKind.ObjectLiteralExpression);
            } else if (body.getKind() === SyntaxKind.ObjectLiteralExpression) {
                objLiteral = body;
            } else if (body.getKind() === SyntaxKind.Block) {
                const returnStmts = body.getStatements().filter(s => s.getKind() === SyntaxKind.ReturnStatement);
                if (returnStmts.length > 0) {
                    objLiteral = returnStmts[0].getExpressionIfKind(SyntaxKind.ObjectLiteralExpression);
                }
            }
        }
        
        if (objLiteral) {
            const props = objLiteral.getProperties();
            const propNames = props.map(p => {
                if (p.getKind() === SyntaxKind.PropertyAssignment || p.getKind() === SyntaxKind.ShorthandPropertyAssignment) {
                    return p.getName();
                }
                return null;
            }).filter(n => n !== null);
            
            if (propNames.length > 0 && propNames.every(n => collectionsToRemove.includes(n))) {
                shouldRemove = true;
            } else if (propNames.some(n => collectionsToRemove.includes(n))) {
                props.forEach(p => {
                     const pName = p.getKind() === SyntaxKind.PropertyAssignment || p.getKind() === SyntaxKind.ShorthandPropertyAssignment ? p.getName() : null;
                     if (pName && collectionsToRemove.includes(pName)) {
                         p.remove();
                     }
                });
                if (objLiteral.getProperties().length === 0) {
                    shouldRemove = true;
                }
            }
        }
        
        if (shouldRemove) {
            const exprStmt = setCall.getParentIfKind(SyntaxKind.ExpressionStatement);
            if (exprStmt) nodesToRemove.push(exprStmt);
            else nodesToRemove.push(setCall);
        }
    });

    nodesToRemove.forEach(n => {
        try { n.remove(); } catch(e){}
    });

    sourceFile.saveSync();
    console.log("AST transformation done.");

    // POST-PROCESSING: text replacements for specific complex cases
    let content = fs.readFileSync('src/stores/dataStore.ts', 'utf-8');

    content = content.replace("import { toast } from '@/hooks/use-toast'", "import { toast } from '@/hooks/use-toast'\nimport { queryClient } from '@/lib/queryClient'");
    content = content.replace(/import { doc, getDoc, getDocs, query, collection, where, limit } from 'firebase\/firestore'/g, "import { doc, getDoc, getDocs, query, collection, where, limit, deleteDoc } from 'firebase/firestore'");
    
    content = content.replace(/const paymentsToDelete = get\(\)\.payments\.filter\(/g, "const paymentsToDelete = [] as Payment[]; // TODO: Fix pending payments deletion logic // \\n      [].filter(");
    
    content = content.replace(/const duplicate = get\(\)\.attendance\.find\(/g, "const duplicate = false; // \\n        [].find(");
    content = content.replace(/const playerAttendance = get\(\)\.attendance\.filter\(/g, "const playerAttendance = [] as AttendanceRecord[]; // \\n        [].filter(");
    
    collectionsToRemove.forEach(col => {
         const regexStr = "(syncDoc(?:WithRetry)?\\('" + col + "',.*?\\)[;]?)";
         content = content.replace(new RegExp(regexStr, 'g'), "$1\n        queryClient.invalidateQueries({ queryKey: ['" + col + "'] });");
         
         const delRegexStr = "(deleteFirestoreDoc\\('" + col + "',.*?\\)[;]?)";
         content = content.replace(new RegExp(delRegexStr, 'g'), "$1\n        queryClient.invalidateQueries({ queryKey: ['" + col + "'] });");
    });

    fs.writeFileSync('src/stores/dataStore.ts', content);
    console.log("Text replacements done.");
}

main().catch(console.error);
