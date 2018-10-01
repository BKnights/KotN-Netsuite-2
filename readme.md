KotN-Netsuite
=============

Various scripts I release to the Netsuite developer community.
The *.ts are TypeScript files. I find Typescript quite helpful in dealing with the Netsuite API. 


## batchProcess.js 
SS2 has done away with nlapiYieldScript in favour of Map/Reduce scripts. Not all batch processes are suitable for Map/Reduce so batchProcess provides a way to nominate a set of targets and work through them. It monitors the governance used by each iteration of the batch and re-triggers the batch when there is less governance available to cover the max usage case.  batchProcess takes 4 functions and a governance reserve:

* `getContext :(origContext : JobContext) => JobContext,` 
Do any initial setup or reading from script parameters here. Useful when the targets come from a search ordered by internal id and each re-trigger of the batch should start from where the last one left off
* `getTargets: (ctx:JobContext, isRerunCheck: boolean) => any[],` 
Return a list of targets to be passed one at a time to process targets. This is run both at the start of the process and when governance is exhausted to see if there are further targets to process. isRerunCheck is true when seeing if there are further targets to process in case logic or processing may be simplified in that case. isReruncheck may also be used to send batch completion notices when there are no more targets to run. The governance required for getTargets is subtracted from the available usage so that this function has a good chance to run when the batch is complete. 
* `processTarget : (ctx : JobContext, simpleArg? : any) => boolean, `
each target is processed by this function. If getTargets returns a list of objects then this function will be applied to that object. Return false to end the batch. Must catch its own errors otherwise the batch is terminated on error.
* `rerunParams : (ctx :JobContext) => any,`
may be used to put lastId (see getTarget) to a script parameter or other values into the next run of the batch
* `passReserve : number = 0`
An initial value used for max governance per pass. 