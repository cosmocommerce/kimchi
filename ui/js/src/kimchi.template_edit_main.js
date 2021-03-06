/*
 * Project Kimchi
 *
 * Copyright IBM, Corp. 2013-2014
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
kimchi.template_edit_main = function() {
    var templateEditMain = $('#edit-template-tabs');
    var origDisks;
    var origPool;
    var origNetworks;
    var templateDiskSize;
    $('#template-name', templateEditMain).val(kimchi.selectedTemplate);
    templateEditMain.tabs();

    var initTemplate = function(template) {
        origDisks =  template.disks;
        origPool = template.storagepool;
        origNetworks = template.networks;
        for(var i=0;i<template.disks.length;i++){
            if(template.disks[i].base){
                template["vm-image"] = template.disks[i].base;
                $('.templ-edit-cdrom').addClass('hide');
                $('.templ-edit-vm-image').removeClass('hide');
                break;
            }
        }
        for ( var prop in template) {
            var value = template[prop];
            if (prop == 'graphics') {
               value = value["type"];
            }
            $('input[name="' + prop + '"]', templateEditMain).val(value);
        }

        var vncOpt = [{label: 'VNC', value: 'vnc'}];
        $('#template-edit-graphics').append('<option selected>VNC</option>');
        $('#template-edit-graphics').append('<option>Spice</option>');
        kimchi.select('template-edit-graphics-list', vncOpt);
        var enableSpice = function() {
            if (kimchi.capabilities == undefined) {
                setTimeout(enableSpice, 2000);
                return;
            }
            if (kimchi.capabilities.qemu_spice == true) {
                spiceOpt = [{label: 'Spice', value: 'spice'}]
                kimchi.select('template-edit-graphics-list', spiceOpt);
            }
        };
        enableSpice();
        var initStorage = function(result) {
            var scsipools = {};
            var addStorageItem = function(storageData) {
                var thisName = storageData.storageName;
                var nodeStorage = $.parseHTML(kimchi.substitute($('#template-storage-pool-tmpl').html(), storageData));
                $('.template-tab-body', '#form-template-storage').append(nodeStorage);
                var storageOptions = '';
                var scsiOptions = '';
                $('select', '#form-template-storage').find('option').remove();
                $.each(result, function(index, storageEntities) {
                    if((storageEntities.state === 'active') && (storageEntities.type != 'kimchi-iso')) {
                        if(storageEntities.type === 'iscsi' || storageEntities.type === 'scsi') {
                            kimchi.listStorageVolumes(storageEntities.name, function(currentVolume) {
                                $.each(currentVolume, function(indexSCSI, scsiEntities) {
                                    var tmpPath = storageEntities.name + '/' + scsiEntities.name;
                                    var isSlected = tmpPath === thisName ? ' selected' : '';
                                    scsiOptions += '<option' + isSlected + '>' + tmpPath + '</option>';
                                });
                                $('select', '#form-template-storage').append(scsiOptions);
                            }, function() {});
                        } else {
                            var isSlected = storageEntities.name === thisName ? ' selected' : '';
                            storageOptions += '<option' + isSlected + '>' + storageEntities.name + '</option>';
                        }
                    }
                });
                $('select', '#form-template-storage').append(storageOptions);
                $('select', '#form-template-storage').change(function() {
                    var selectedItem = $(this).parent().parent();
                    var tempStorageNameFull = $(this).val();
                    var tempType;
                    var tempStorageName =tempStorageNameFull.split('/')[0];
                    var scsiCap;
                    $.each(result, function(index, storageEntities) {
                        if (tempStorageName === storageEntities.name) {
                            selectedItem.find('.template-storage-type').val(storageEntities.type);
                            scsiCap = storageEntities.capacity / Math.pow(1024, 3);
                            tempType = storageEntities.type;
                        }
                    });
                    if (tempType === 'iscsi' || tempType === 'scsi') {
                        $('.template-storage-disk', selectedItem).attr('readonly', true).val(scsiCap);
                    } else {
                        $('.template-storage-disk', selectedItem).attr('readonly', false).val('10');
                    }
                    $('.template-storage-name').val(tempStorageNameFull);
                });
            };

            if ((origDisks && origDisks.length) && (origPool && origPool.length)) {
                splitPool = origPool.split('/');
                var defaultPool;
                var defaultType;
                $.each(result, function(index, poolEntities) {
                    if (poolEntities.name === splitPool[splitPool.length-1]) {
                        defaultType = poolEntities.type;
                        defaultPool = splitPool[splitPool.length-1]
                    }
                });
                if (origDisks[0]['volume']) {
                    defaultPool = defaultPool + '/' + origDisks[0]['volume'];
                }
                $.each(origDisks, function(index, diskEntities) {
                    var storageNodeData = {
                        viewMode : '',
                        editMode : 'hide',
                        storageName : defaultPool,
                        storageType : defaultType,
                        storageDisk : diskEntities.size
                    }
                    addStorageItem(storageNodeData);
                });
                if(defaultType === 'iscsi' || defaultType === 'scsi') {
                    $('.template-storage-disk').attr('readonly', true);
                }
            }

            $('#template-edit-storage-add-button').button({
                icons: {
                    primary: "ui-icon-plusthick"
                },
                text: false,
                disabled: true
            }).click(function(event) {
                event.preventDefault();
                var storageNodeData = {
                    viewMode : 'hide',
                    editMode : '',
                    storageName : 'null',
                    storageType : 'dir',
                    storageDisk : '10'
                }
                addStorageItem(storageNodeData);
            });
        };
        var initInterface = function(result) {
            var networkItemNum = 0;
            var addInterfaceItem = function(networkData) {
                var networkName = networkData.networkV;
                var nodeInterface = $.parseHTML(kimchi.substitute($('#template-interface-tmpl').html(), networkData));
                $('.template-tab-body', '#form-template-interface').append(nodeInterface);
                $('.delete', '#form-template-interface').button({
                    icons : {primary : 'ui-icon-trash'},
                    text : false
                }).click(function(evt) {
                    evt.preventDefault();
                    $(this).parent().parent().remove();
                });
                var networkOptions = '';
                for(var i=0;i<result.length;i++){
                    if(result[i].state === "active") {
                        var isSlected = networkName===result[i].name ? ' selected' : '';
                        networkOptions += '<option' + isSlected + '>' + result[i].name + '</option>';
                    }
                }
                $('select', '#form-template-interface #networkID' + networkItemNum).append(networkOptions);
                networkItemNum += 1;
            };
            if(result && result.length > 0) {
                for(var i=0;i<origNetworks.length;i++) {
                    addInterfaceItem({
                        networkID : 'networkID' + networkItemNum,
                        networkV : origNetworks[i],
                        type : 'network'
                    });
                }
            }
            $('#template-edit-interface-add-button').button({
                icons: {
                    primary: 'ui-icon-plusthick'
                },
                text: false
            }).click(function(evt) {
                evt.preventDefault();
                addInterfaceItem({
                    networkID : 'networkID' + networkItemNum,
                    networkV : 'default',
                    type : 'network'
                });
            });
        };
        var initProcessor = function(){
            var setCPUValue = function(){
                if(!$('#cores').hasClass("invalid-field")&&$('#cores').val()!=""){
                    $("#cpus").val(parseInt($("#cores").val())*parseInt($("#threads").val()));
                }else{
                    $("#cpus").val('');
                }
            };
            $("input:text", "#form-template-processor").on('keyup', function(){
                $(this).toggleClass("invalid-field", !$(this).val().match('^[0-9]*$'));
                if($(this).prop('id')=='cores') setCPUValue();
            });
            $("input:checkbox", "#form-template-processor").click(function(){
                $(".topology", "#form-template-processor").toggleClass("hide", !$(this).prop("checked"));
                $("#cpus").attr("disabled", $(this).prop("checked"));
                setCPUValue();
            });
            $('select', '#form-template-processor').change(function(){
                setCPUValue();
            });
            kimchi.getCPUInfo(function(data){
                var options = "";
                for(var i=0;Math.pow(2,i)<=data.threads_per_core;i++){
                    var lastOne = Math.pow(2,i+1)>data.threads_per_core?" selected":"";
                    options += "<option"+lastOne+">"+Math.pow(2,i)+"</option>";
                }
                $('select', '#form-template-processor').append(options);
                if(template.cpus) $("#cpus").val(template.cpus);
                var topo = template.cpu_info.topology;
                if(topo&&topo.cores) $("#cores").val(topo.cores);
                if(topo&&topo.threads){
                    $('select', '#form-template-processor').val(topo.threads);
                    $("input:checkbox", "#form-template-processor").trigger('click');
                }
            });
        };
        kimchi.listNetworks(initInterface);
        kimchi.listStoragePools(initStorage);
        initProcessor();
    };
    kimchi.retrieveTemplate(kimchi.selectedTemplate, initTemplate);


    $('#tmpl-edit-button-save').on('click', function() {
        var editableFields = [ 'name', 'memory', 'disks', 'graphics'];
        var data = {};
        //Fix me: Only support one storage pool now
        var storages = $('.template-tab-body .item', '#form-template-storage');
        var tempName = $('.template-storage-name', storages).val();
        tempName = tempName.split('/');
        var tempNameHead =tempName[0];
        var tempNameTail = tempNameHead;
        if(tempNameHead === 'iscsi' || tempNameHead =='scsi') {
            tempNameTail = tempName[tempName.length-1];
        }
        tempName = '/storagepools/' + tempNameHead;
        data['storagepool'] = tempName;
        $.each(editableFields, function(i, field) {
            /* Support only 1 disk at this moment */
            if (field == 'disks') {
                var tmpItem = $('#form-template-storage .item');
                origDisks[0].size = Number($('.template-storage-disk', tmpItem).val());
                if($('.template-storage-type', tmpItem).val() === 'iscsi' || $('.template-storage-type', tmpItem).val() =='scsi') {
                    origDisks[0]['volume'] = tempNameTail;
                } else {
                    origDisks[0]['volume'] && delete origDisks[0]['volume'];
                }
               data[field] = origDisks;
            }
            else if (field == 'graphics') {
               var type = $('#form-template-general [name="' + field + '"]').val();
               data[field] = {'type': type};
            }
            else {
               data[field] = $('#form-template-general [name="' + field + '"]').val();
            }
        });
        data['memory'] = Number(data['memory']);
        data['cpus']   = parseInt($('#cpus').val());
        if($("input:checkbox", "#form-template-processor").prop("checked")){
            data['cpu_info'] = {
                topology: {
                    sockets: 1,
                    cores: parseInt($("#cores").val()),
                    threads: parseInt($("#threads").val())
                }
            };
        }else{
            data['cpu_info'] = {};
        }
        var networks = $('.template-tab-body .item', '#form-template-interface');
        var networkForUpdate = new Array();
        $.each(networks, function(index, networkEntities) {
            var thisValue = $('select', networkEntities).val();
            networkForUpdate.push(thisValue);
        });
        if (networkForUpdate instanceof Array) {
            data.networks = networkForUpdate;
        } else if (networkForUpdate != null) {
            data.networks = [networkForUpdate];
        } else {
            data.networks = [];
        }

        kimchi.updateTemplate($('#template-name').val(), data, function() {
            kimchi.doListTemplates();
            kimchi.window.close();
        }, function(err) {
            kimchi.message.error(err.responseJSON.reason);
        });
    });
};
