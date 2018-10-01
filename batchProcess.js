/*
Utility Functions
copyright 2008 - 2018 Brett Knights. All rights reserved. This material may not be reproduced,
displayed, modified or distributed without the express prior written
permission of the copyright holder.
For permission, contact brett@knightsofthenet.com
*/
define(["require", "exports", "N/log", "N/runtime", "N/task"], function (require, exports, log, runtime, task) {
    Object.defineProperty(exports, "__esModule", { value: true });
    function batchProcess(getContext, getTargets, processTarget, rerunParams, passReserve) {
        if (passReserve === void 0) { passReserve = 0; }
        var targetUsage = 0;
        var rawContext = {
            getTargetsUsage: function () { return targetUsage; },
            getMaxUsage: function () { return targetUsage; }
        };
        var context = getContext(rawContext);
        var me = runtime.getCurrentScript();
        var targetStartUsage = me.getRemainingUsage();
        var targets = getTargets(context, false);
        targetUsage = targetStartUsage - me.getRemainingUsage();
        if (!targets || !targets.length) {
            log.debug({ title: 'batch process', details: 'No targets found to process' });
            return;
        }
        targets = [].concat(targets); // make it a true array and make it independent of orig target; sometimes NS weirdness
        try {
            var targetCount = 0;
            var maxUsage = passReserve;
            var origTargetLength = targets.length;
            each(targets, function (idx, target) {
                var initUsage = me.getRemainingUsage();
                try {
                    var flag = processTarget.call(typeof target == 'object' ? target : {}, context, target);
                    if (typeof flag != 'undefined' && !flag)
                        return false;
                }
                catch (e) {
                    log.error({ title: 'error processing target', details: (e.message || e.toString()) + (e.getStackTrace ? '\n\n' + e.getStackTrace().join('\n') : '') });
                    return false; // exit on failure. processTarget should catch own errors to continue on failure.
                }
                var remainUsage = me.getRemainingUsage();
                var passUsage = initUsage - remainUsage;
                if (passUsage > maxUsage)
                    maxUsage = passUsage;
                targetCount++;
                if (runtime.executionContext == runtime.ContextType.SCHEDULED) {
                    var usageToFinish = targets.length * maxUsage;
                    if (targets.length && usageToFinish < remainUsage) { //in simple case targets.length decrements once per iteration
                        var pctRemaining = targets.length / (targets.length + targetCount);
                        me.percentComplete = (100 * (1 - pctRemaining));
                    }
                    else
                        me.percentComplete = (100 * (1 - (remainUsage / targetStartUsage)));
                }
                var canGo = remainUsage > (maxUsage + targetUsage + 10); // an iteration plus the follow up targetUsage + 10
                context.getMaxUsage = function () { return maxUsage; };
                log.debug({ title: "usage profile", details: "remaining: " + remainUsage + "\npassUsage: " + passUsage + "\nmaxUsage: " + maxUsage });
                if (!canGo)
                    log.audit({ title: 'Processing Targets', details: 'processed: ' + targetCount + ' targets' });
                return canGo;
            });
            var remainder = getTargets(context, true);
            if (remainder && remainder.length) {
                if (runtime.executionContext == runtime.ContextType.SCHEDULED) { //check executionContext to avoid invalid calls in debugger
                    var schedTask = task.create({
                        taskType: task.TaskType.SCHEDULED_SCRIPT,
                        scriptId: me.id,
                        deploymentId: me.deploymentId,
                        params: rerunParams(context)
                    });
                    var reschedId = schedTask.submit();
                    log.audit({
                        title: 'Rescheduled task as ' + reschedId,
                        details: "finished run " + remainder.length + " targets left to process."
                    });
                }
                else
                    log.audit({ title: 'Processing Targets', details: "finished non-scheduled run " + remainder.length + " targets left to process." });
            }
        }
        catch (e) {
            log.error({ title: e.message || e.toString(), details: e.message || e.toString() + (e.getStackTrace ? '\n\n' + e.getStackTrace().join('\n') : '') });
        }
        function each(arr, fcn) {
            var idx = 0;
            while (true) {
                if (!arr || !arr.length)
                    return;
                var target = arr.shift(); // use shift so that processTarget can add or remove elements from the list
                if (!target)
                    return;
                var x = fcn.call(typeof target == 'object' ? target : null, idx, target);
                if (typeof x != 'undefined' && x !== null && !(x))
                    return;
                idx++;
            }
        }
    }
    exports.batchProcess = batchProcess;
});
